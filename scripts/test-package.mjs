import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const build = path.join(root, 'build/packages/sequelize-guard');
const consumer = mkdtempSync(path.join(tmpdir(), 'sequelize-guard-consumer-'));
after(() => rmSync(consumer, { recursive: true, force: true }));

function packForConsumer() {
  const [packed] = JSON.parse(
    execFileSync(
      'npm',
      [
        'pack',
        build,
        '--json',
        '--ignore-scripts',
        '--pack-destination',
        consumer,
      ],
      { encoding: 'utf8', cwd: consumer },
    ),
  );
  return path.join(consumer, packed.filename);
}

const tarball = process.env.RELEASE_TARBALL
  ? path.resolve(process.env.RELEASE_TARBALL)
  : packForConsumer();
const installed = path.join(consumer, 'node_modules/sequelize-guard');
mkdirSync(installed, { recursive: true });
execFileSync('tar', ['-xzf', tarball, '--strip-components=1', '-C', installed]);
const manifest = JSON.parse(
  readFileSync(path.join(installed, 'package.json'), 'utf8'),
);

// Reuse locked dependencies offline; the library itself must come from its tarball.
for (const name of new Set([
  ...Object.keys(manifest.dependencies),
  ...Object.keys(manifest.peerDependencies),
  'sqlite3',
  '@types/node',
])) {
  const destination = path.join(consumer, 'node_modules', name);
  mkdirSync(path.dirname(destination), { recursive: true });
  symlinkSync(path.join(root, 'node_modules', name), destination, 'dir');
}

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
  assert.deepEqual((await user.roles()).map(role => role.name), ['reader']);
  assert.equal((await guard.getUserRoles(user))[0].save, undefined);
  const modelPermission = (await guard.createPerms('document', 'edit'))[0];
  assert.equal(typeof modelPermission.save, 'function');
  const jsonPermission = (await guard.createPerms('document', 'edit', { all: true, json: true }))[0];
  assert.equal(jsonPermission.save, undefined);
  assert.equal((await guard.makeRoles(['editor']))[0].save, undefined);
  assert.equal(typeof (await guard.makeRoles(['editor'], { all: true }))[0].save, 'function');
  assert.equal(await guard.getRole('unknown'), null);
  assert.equal(typeof (await guard.getCache()).getRoles()[1].save, 'function');
  assert.equal((await guard.getCache()).getPerms()[modelPermission.id].save, undefined);
  assert.equal(await user.can('read document'), true);
  assert.equal(await user.can('edit document'), false);
  await user.rmAssignedRoles(['reader']);
  assert.equal(await user.can('read document'), false);
  assert.equal(await user.isA('reader'), false);
} finally {
  await sequelize.close();
}
`;

test('packed package works in native Node ESM', () => {
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
    stdio: 'inherit',
  });
});

test('packed package works in native Node CommonJS', () => {
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
    stdio: 'inherit',
  });
});

const typedConsumer = `
import Guard, { SequelizeGuard, migration, type GuardOptions } from 'sequelize-guard';
import { Sequelize } from 'sequelize';
export async function useGuard(sequelize: Sequelize) {
  const guard = new Guard(sequelize);
  await guard.ready;
  const synced: SequelizeGuard = await guard.sync({ logging: false, alter: { drop: false } });
  // @ts-expect-error Sync options follow Sequelize's types.
  await guard.sync({ force: 'yes' });
  // @ts-expect-error Guard policy tables always use id.
  new Guard(sequelize, { primaryKey: 'accountKey' });
  await guard.allow('reader', ['read'], 'document');
  await guard.init().allow('editor').to('edit').on('document').commit();
  const user = await guard.makeUser();
  const id: number = user.id;
  await user.assignRole('reader');
  await user.assignRoles(['editor']);
  await user.rmAssignedRoles(['editor']);
  const userCheck: boolean = await user.can('read document');
  const userRoles = await user.roles();
  await userRoles[0].save();
  await guard.assignRole(user, 'reader');

  const change = await guard.assignRolesToUsers([user], ['reader']);
  const assigned: number = change.assigned;
  const another = await guard.assignUserRoles([{ user, roles: ['editor'] }]);
  const anotherAssigned: number = another.assigned;
  // @ts-expect-error Bulk result is an object containing a count.
  const wrongBulk: number = another;
  // @ts-expect-error Bulk roles must be strings.
  await guard.assignRolesToUsers([user], [42]);

  const models = await guard.createPerms('document', 'read');
  await models[0].save();
  const json = await guard.createPerms('document', 'write', { json: true });
  const explicitModel = await guard.createPerms('document', 'edit', { json: false });
  await explicitModel[0].save();
  // @ts-expect-error JSON permission results have no model methods.
  await json[0].save();
  const dynamicJson: { json: boolean } = { json: Date.now() > 0 };
  const dynamic = await guard.createPerms('document', 'share', dynamicJson);
  // @ts-expect-error Dynamic JSON options can also return plain data.
  await dynamic[0].save();

  const bulk = await guard.createPermsBulk([{ resource: 'document', actions: 'read' }], { json: true });
  // @ts-expect-error Bulk JSON permission results also have no model methods.
  await bulk[0].save();
  const bulkModels = await guard.createPermsBulk([{ resource: 'document', actions: 'read' }]);
  await bulkModels[0].save();

  const roleJson = await guard.makeRoles(['editor']);
  // @ts-expect-error JSON is the default when makeRoles receives no options.
  await roleJson[0].save();
  const roleModels = await guard.makeRoles(['editor'], {});
  await roleModels[0].save();
  const roleJsonOptions = await guard.makeRoles(['editor'], { json: true });
  // @ts-expect-error Explicit JSON role results have no model methods.
  await roleJsonOptions[0].save();

  const maybeRole = await guard.getRole('reader');
  // @ts-expect-error Missing roles return null.
  await maybeRole.save();
  const removed = await guard.rmPermsFromRole('missing', 'read', 'document');
  // @ts-expect-error The removed role is null when not found.
  await removed.role.save();

  const allowed: boolean = await guard.userCan(user, 'read document');
  const roles = await guard.getUserRoles(user);
  // @ts-expect-error Assigned roles are plain data.
  await roles[0].save();
  const cache = await guard.getCache();
  await cache.getRoles()[1].save();
  // @ts-expect-error Permission cache entries are plain data.
  await cache.getPerms()[1].save();
  await migration.up(sequelize.getQueryInterface(), sequelize);
  // @ts-expect-error Role names must be strings.
  await guard.assignRole(user, 123);
  // @ts-expect-error Permission checks return booleans.
  const wrong: string = await guard.userCan(user, 'read document');
  return { allowed, roles, cache, synced, id, userCheck, assigned, anotherAssigned };
}

import type { Model, ModelStatic, InferAttributes, InferCreationAttributes } from 'sequelize';
export function useConfiguredGuard(sequelize: Sequelize, options: GuardOptions): SequelizeGuard<Model> {
  return new Guard(sequelize, options);
}
declare class Account extends Model<InferAttributes<Account>, InferCreationAttributes<Account>> {
  accountKey: string;
  displayName: string;
}
export async function useCustomUser(sequelize: Sequelize, AccountModel: ModelStatic<Account>) {
  const guard = new Guard(sequelize, { UserModel: AccountModel, userPk: 'accountKey', sync: false });
  const user = await guard.models().GuardUser.create({ accountKey: 'alice', displayName: 'Alice' });
  const key: string = user.accountKey;
  const allowed: boolean = await user.can('read document');
  const sameUser: Account = await user.assignRole('reader');
  // @ts-expect-error An explicitly typed model must be supplied to the constructor.
  new Guard<Account>(sequelize);
  // @ts-expect-error The supplied model has no built-in user id.
  const id: number = (await guard.makeUser()).id;
  // @ts-expect-error Supplied model creation retains its required attributes.
  await guard.models().GuardUser.create({ accountKey: 'alice' });
  return { key, allowed, sameUser };
}
`;

for (const [extension, module, moduleResolution] of [
  ['mts', 'NodeNext', 'NodeNext'],
  ['cts', 'NodeNext', 'NodeNext'],
  ['ts', 'ESNext', 'Bundler'],
]) {
  test(`packed declarations work with ${extension} / ${moduleResolution}`, () => {
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
      [
        path.join(root, 'node_modules/typescript/bin/tsc'),
        '-p',
        'tsconfig.json',
      ],
      { cwd: consumer, stdio: 'inherit' },
    );
  });
}

test('tarball contains only distributable files', () => {
  const files = execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8' })
    .trimEnd()
    .split('\n');
  assert.ok(files.includes('package/README.md'));
  assert.ok(files.includes('package/LICENSE'));
  assert.ok(
    !files.some((file) =>
      /(?:^|\/)(?:__tests__|coverage|node_modules)(?:\/|$)/.test(file),
    ),
  );
});

if (process.env.RELEASE_VERSION) {
  test('tarball manifest matches the release version', () => {
    assert.equal(manifest.version, process.env.RELEASE_VERSION);
  });
}
