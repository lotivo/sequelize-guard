import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const consumer = realpathSync(
  mkdtempSync(path.join(tmpdir(), 'sequelize-guard-consumer-')),
);
const env = {
  ...process.env,
  PATH: [path.dirname(process.execPath), process.env.PATH]
    .filter(Boolean)
    .join(path.delimiter),
};
delete env.NODE_PATH;
delete env.NODE_OPTIONS;
after(() => rmSync(consumer, { recursive: true, force: true }));
const packOutput = process.env.RELEASE_TARBALL
  ? null
  : execFileSync(
      'npm',
      [
        'pack',
        path.join(root, 'build/packages/sequelize-guard'),
        '--json',
        '--ignore-scripts',
        '--pack-destination',
        consumer,
      ],
      { cwd: consumer, env, encoding: 'utf8' },
    );
// npm 11 returns an array; npm 12 may key the result by package name.
const packed = packOutput && Object.values(JSON.parse(packOutput));
if (packed) assert.equal(packed.length, 1, 'Expected one packed archive');
const tarball = process.env.RELEASE_TARBALL
  ? path.resolve(process.env.RELEASE_TARBALL)
  : path.join(consumer, packed[0].filename);
const manifest = JSON.parse(
  execFileSync('tar', ['-xOzf', tarball, 'package/package.json'], {
    encoding: 'utf8',
  }),
);
const expectedFiles = [
  'package/LICENSE',
  'package/README.md',
  'package/dist/cjs/index.cjs',
  'package/dist/cjs/index.cjs.map',
  'package/dist/esm/index.esm.js',
  'package/dist/esm/index.esm.js.map',
  'package/package.json',
  'package/types/index.d.cts',
  'package/types/index.d.ts',
];

test('archive has the exact distributable files and documented declarations', () => {
  const list = (flag) =>
    execFileSync('tar', [flag, tarball], { encoding: 'utf8' })
      .trimEnd()
      .split('\n');
  assert.deepEqual(list('-tzf').sort(), expectedFiles.sort());
  assert.ok(list('-tvzf').every((entry) => entry.startsWith('-')));
  assert.deepEqual(
    manifest,
    JSON.parse(
      readFileSync(
        path.join(root, 'packages/sequelize-guard/package.json'),
        'utf8',
      ),
    ),
  );
  if (process.env.RELEASE_VERSION)
    assert.equal(manifest.version, process.env.RELEASE_VERSION);
  for (const extension of ['d.ts', 'd.cts']) {
    const text = execFileSync(
      'tar',
      ['-xOzf', tarball, `package/types/index.${extension}`],
      { encoding: 'utf8' },
    );
    assert.match(text, /Omitted options return plain data/);
    assert.match(text, /json: true.*returns plain data/);
    assert.match(text, /GuardCreationResult/);
  }
});

writeFileSync(
  path.join(consumer, 'package.json'),
  JSON.stringify({
    name: 'sequelize-guard-consumer',
    private: true,
    allowScripts: { 'sqlite3@6.0.1': true }, // npm 12 native-addon approval.
  }),
);
execFileSync(
  'npm',
  [
    'install',
    '--strict-peer-deps',
    '--prefer-online',
    '--no-audit',
    '--no-fund',
    tarball,
    `sequelize@${manifest.peerDependencies.sequelize}`,
    'sqlite3@6.0.1',
    'typescript@5.9.3',
    '@types/node@24.10.1',
  ],
  { cwd: consumer, env, stdio: 'inherit' },
);
for (const name of [
  'sequelize-guard',
  'sequelize',
  'sqlite3',
  'typescript',
  '@types/node',
]) {
  const dependency = path.join(consumer, 'node_modules', name);
  assert.equal(
    realpathSync(dependency),
    dependency,
    `${name} must not be a workspace symlink`,
  );
}
assert.equal(
  JSON.parse(
    readFileSync(
      path.join(consumer, 'node_modules/sequelize-guard/package.json'),
      'utf8',
    ),
  ).version,
  manifest.version,
);

const runtime = `
assert.equal(Guard, SequelizeGuard);
assert.equal(migration, Guard.migration);
const sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
try {
  const guard = new Guard(sequelize, { sync: false });
  await guard.ready;
  assert.equal(await guard.sync({ logging: false }), guard);
  await guard.allow('reader', 'read', 'document');
  const user = await guard.makeUser();
  await user.assignRole('reader');
  assert.equal(await user.can('read document'), true);
  assert.equal(await user.can('edit document'), false);
  const models = await guard.createPerms('document', 'edit');
  assert.equal(typeof models[0].save, 'function');
  const json = await guard.createPerms('document', 'edit', { all: true, json: true });
  assert.equal(json[0].save, undefined);
  const roleData = await guard.makeRoles(['editor']);
  assert.equal(roleData[0].save, undefined);
  const roleModels = await guard.makeRoles(['editor'], { all: true });
  assert.equal(typeof roleModels[0].save, 'function');
  const allRoleData = await guard.makeRoles(['editor'], { all: true, json: true });
  assert.equal(allRoleData[0].save, undefined);
  await user.rmAssignedRoles(['reader']);
  assert.equal(await user.isA('reader'), false);
} finally { await sequelize.close(); }
`;

test('fresh installation works with native ESM', () => {
  writeFileSync(
    path.join(consumer, 'consumer.mjs'),
    `
import assert from 'node:assert/strict';
import { Sequelize } from 'sequelize';
import Guard, { SequelizeGuard, migration } from 'sequelize-guard';
${runtime}`,
  );
  execFileSync(process.execPath, ['consumer.mjs'], {
    cwd: consumer,
    env,
    stdio: 'inherit',
  });
});

test('fresh installation works with native CommonJS', () => {
  writeFileSync(
    path.join(consumer, 'consumer.cjs'),
    `
const assert = require('node:assert/strict');
const { Sequelize } = require('sequelize');
const { default: Guard, SequelizeGuard, migration } = require('sequelize-guard');
(async () => { ${runtime} })().catch(error => { console.error(error); process.exitCode = 1; });`,
  );
  execFileSync(process.execPath, ['consumer.cjs'], {
    cwd: consumer,
    env,
    stdio: 'inherit',
  });
});

const typedConsumer = `
import Guard, { SequelizeGuard, migration, type GuardOptions } from 'sequelize-guard';
import { Sequelize, Model, DataTypes, type InferAttributes, type InferCreationAttributes } from 'sequelize';
export async function useGuard(sequelize: Sequelize, options: GuardOptions) {
  const guard: SequelizeGuard = new Guard(sequelize, options);
  await guard.ready;
  const synced: SequelizeGuard = await guard.sync({ logging: false, alter: { drop: false } });
  // @ts-expect-error Sequelize sync force is boolean.
  await guard.sync({ force: 'yes' });
  const models = await guard.createPerms('document', 'read');
  await models[0].save();
  const json = await guard.createPerms('document', 'write', { json: true });
  // @ts-expect-error Plain permission data has no model methods.
  await json[0].save();
  const dynamic: { json: boolean } = { json: Date.now() > 0 };
  const either = await guard.createPerms('document', 'edit', dynamic);
  // @ts-expect-error Dynamic format may return plain data.
  await either[0].save();
  const bulkJson = await guard.createPermsBulk([{ resource: 'document', actions: 'share' }], { json: true });
  // @ts-expect-error Bulk plain data has no model methods.
  await bulkJson[0].save();
  const roleData = await guard.makeRoles(['reader']);
  // @ts-expect-error Omitted options return plain role data.
  await roleData[0].save();
  const roleModels = await guard.makeRoles(['editor'], {});
  await roleModels[0].save();
  const roleJson = await guard.makeRoles(['editor'], { json: true });
  // @ts-expect-error Plain role data has no model methods.
  await roleJson[0].save();
  const allowed: boolean = await guard.userCan(await guard.makeUser(), 'read document');
  const cache = await guard.getCache();
  // @ts-expect-error Cached permissions are plain data.
  await cache.getPerms()[1].save();
  await cache.getRoles()[1].save();
  await migration.up(sequelize.getQueryInterface(), sequelize);
  return { synced, allowed };
}

class Account extends Model<InferAttributes<Account>, InferCreationAttributes<Account>> {
  declare accountKey: string;
  declare requiredName: string;
}
export function typedCustomUser(sequelize: Sequelize) {
  const UserModel = sequelize.define<Account>('Account', {
    accountKey: { type: DataTypes.STRING, primaryKey: true },
    requiredName: { type: DataTypes.STRING, allowNull: false },
  });
  const guard = new Guard(sequelize, { UserModel, userPk: 'accountKey', sync: false });
  const account = guard.models().GuardUser.build({ accountKey: 'a', requiredName: 'Alice' });
  const key: string = account.accountKey;
  // @ts-expect-error Custom user fields remain required.
  guard.models().GuardUser.build({ accountKey: 'a' });
  // @ts-expect-error Guard methods require this UserModel's instance type.
  guard.userCan({} as Model, 'read document');
  return { guard, account, key };
}
`;
for (const [extension, module, moduleResolution] of [
  ['mts', 'NodeNext', 'NodeNext'],
  ['cts', 'NodeNext', 'NodeNext'],
  ['ts', 'ESNext', 'Bundler'],
]) {
  test(`packed declarations compile as ${extension} / ${moduleResolution}`, () => {
    writeFileSync(path.join(consumer, `consumer.${extension}`), typedConsumer);
    writeFileSync(
      path.join(consumer, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          strict: true,
          noEmit: true,
          skipLibCheck: false,
          target: 'ES2020',
          module,
          moduleResolution,
          types: ['node'],
        },
        files: [`consumer.${extension}`],
      }),
    );
    execFileSync(
      process.execPath,
      ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'],
      { cwd: consumer, env, stdio: 'inherit' },
    );
  });
}
