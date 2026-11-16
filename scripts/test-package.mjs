import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  cpSync,
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
const build = path.join(root, 'build/packages/sequelize-guard');
const consumer = realpathSync(
  mkdtempSync(path.join(tmpdir(), 'sequelize-guard-consumer-')),
);
const env = {
  ...process.env,
  // npm and native-addon lifecycle scripts use the same supported Node runtime
  // as the import, declarations, and executable-recipe checks.
  PATH: [path.dirname(process.execPath), process.env.PATH]
    .filter(Boolean)
    .join(path.delimiter),
};
delete env.NODE_PATH;
delete env.NODE_OPTIONS;
after(() => rmSync(consumer, { recursive: true, force: true }));

function packForConsumer() {
  const packOutput = execFileSync(
    'npm',
    ['pack', build, '--json', '--ignore-scripts', '--pack-destination', consumer],
    { encoding: 'utf8', cwd: consumer, env },
  );
  // npm 12 keys pack results by package name. Earlier versions use an array.
  const packages = Object.values(JSON.parse(packOutput));
  assert.equal(packages.length, 1, 'Expected npm pack to create one tarball');
  const [packed] = packages;
  return path.join(consumer, packed.filename);
}

const tarball = process.env.RELEASE_TARBALL
  ? path.resolve(process.env.RELEASE_TARBALL)
  : packForConsumer();
const manifest = JSON.parse(
  execFileSync('tar', ['-xOzf', tarball, 'package/package.json'], {
    encoding: 'utf8',
  }),
);
const distributedFiles = [
  'package/LICENSE',
  'package/skills/sequelize-guard/SKILL.md',
  'package/skills/sequelize-guard/references/installed-package.mjs',
  'package/examples/README.md',
  'package/examples/basic.mjs',
  'package/examples/basic.cjs',
  'package/examples/custom-user.ts',
  'package/examples/migrations.mjs',
  'package/examples/authorization.mjs',
  'package/examples/advanced.mjs',
  'package/examples/upgrade.mjs',
  'package/README.md',
  'package/dist/cjs/index.cjs',
  'package/dist/cjs/index.cjs.map',
  'package/dist/esm/index.esm.js',
  'package/dist/esm/index.esm.js.map',
  'package/package.json',
  'package/types/index.d.cts',
  'package/types/index.d.ts',
];

test('installs the exact packed files with fresh dependencies', () => {
  const list = (flags) =>
    execFileSync('tar', [flags, tarball], { encoding: 'utf8' })
      .trimEnd()
      .split('\n');
  assert.deepEqual(list('-tzf').sort(), distributedFiles.sort());
  assert.ok(list('-tvzf').every((entry) => entry.startsWith('-')));

  for (const file of [
    'README.md',
    'LICENSE',
    'skills/sequelize-guard/SKILL.md',
    'skills/sequelize-guard/references/installed-package.mjs',
  ]) {
    assert.equal(
      execFileSync('tar', ['-xOzf', tarball, `package/${file}`], {
        encoding: 'utf8',
      }),
      readFileSync(path.join(root, file), 'utf8'),
      `${file} must match the frozen release source`,
    );
  }
  const sourceManifest = JSON.parse(
    readFileSync(
      path.join(root, 'packages/sequelize-guard/package.json'),
      'utf8',
    ),
  );
  // A rehearsal RC substitutes only the version in an isolated staging copy.
  assert.deepEqual(manifest, { ...sourceManifest, version: manifest.version });

  writeFileSync(
    path.join(consumer, 'package.json'),
    JSON.stringify({
      name: 'sequelize-guard-consumer',
      private: true,
      // npm 12 requires approval for this native test driver's install script.
      allowScripts: { 'sqlite3@6.0.1': true },
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
      'sequelize-guard-previous@npm:sequelize-guard@6.0.2',
      'sqlite3@6.0.1',
      'typescript@5.9.3',
      'express@5.1.0',
      '@types/node@24.10.1',
    ],
    { cwd: consumer, env, stdio: 'inherit' },
  );

  for (const name of [
    'sequelize-guard',
    'sequelize',
    'sequelize-guard-previous',
    'sqlite3',
    'typescript',
    '@types/node',
  ]) {
    const dependency = path.join(consumer, 'node_modules', name);
    assert.equal(realpathSync(dependency), dependency);
  }
  const packageVersion = (name) =>
    JSON.parse(
      readFileSync(
        path.join(consumer, 'node_modules', name, 'package.json'),
        'utf8',
      ),
    ).version;
  assert.equal(packageVersion('sequelize-guard'), manifest.version);
  assert.equal(packageVersion('sequelize-guard-previous'), '6.0.2');
});

const runtime = `
assert.equal(Guard, SequelizeGuard);
assert.equal(migration, Guard.migration);
const sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
try {
  const Team = sequelize.define('Team', {});
  await Team.sync();
  const guard = new Guard(sequelize, { sync: false, roleHolders: { team: Team } });
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

  const team = await Team.create();
  assert.deepEqual(await guard.assignRolesToHolder(team, ['editor']), { assigned: 1 });
  const child = await guard.setRoleParent('editor', 'reader');
  assert.equal(typeof child.save, 'function');
  const roles = await guard.getHolderRoles(team);
  assert.deepEqual(roles.map(role => role.name), ['editor']);
  assert.equal(roles[0].save, undefined);
  assert.equal(await guard.holderCan(team, 'read document'), true);
  await guard.removeRolesFromHolder(team, ['editor']);
  assert.equal(await guard.holderCan(team, 'read document'), false);
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
    env,
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
    env,
    stdio: 'inherit',
  });
});

test('upgrades a published 6.0.2 app with a custom user key', () => {
  cpSync(
    path.join(consumer, 'node_modules/sequelize-guard/examples/upgrade.mjs'),
    path.join(consumer, 'upgrade.mjs'),
  );
  execFileSync(process.execPath, ['upgrade.mjs'], {
    cwd: consumer,
    env,
    stdio: 'inherit',
  });
});

// Execute the same files referenced by the human documentation from a clean
// installation, so workspace imports cannot conceal missing package exports.
test('documentation recipes run against the installed archive', () => {
  cpSync(
    path.join(consumer, 'node_modules/sequelize-guard/examples'),
    path.join(consumer, 'examples'),
    {
      recursive: true,
    },
  );
  for (const packedPath of distributedFiles.filter((file) =>
    file.startsWith('package/examples/'),
  )) {
    const relativePath = packedPath.slice('package/'.length);
    assert.equal(
      readFileSync(
        path.join(consumer, 'node_modules/sequelize-guard', relativePath),
        'utf8',
      ),
      readFileSync(path.join(root, relativePath), 'utf8'),
      `${relativePath} must match the shared documentation source`,
    );
  }
  writeFileSync(
    path.join(consumer, 'examples/package.json'),
    JSON.stringify({ type: 'module' }),
  );
  for (const recipe of [
    'basic.mjs',
    'basic.cjs',
    'migrations.mjs',
    'authorization.mjs',
    'advanced.mjs',
  ]) {
    execFileSync(process.execPath, [path.join('examples', recipe)], {
      cwd: consumer,
      env,
      stdio: 'inherit',
    });
  }
  execFileSync(
    process.execPath,
    [
      'node_modules/typescript/bin/tsc',
      '--strict',
      '--outDir',
      'examples/.compiled',
      '--skipLibCheck',
      'false',
      '--target',
      'ES2022',
      '--module',
      'NodeNext',
      '--moduleResolution',
      'NodeNext',
      'examples/custom-user.ts',
    ],
    { cwd: consumer, env, stdio: 'inherit' },
  );
  execFileSync(process.execPath, ['examples/.compiled/custom-user.js'], {
    cwd: consumer,
    env,
    stdio: 'inherit',
  });
});

test('installed portable skill detects the consumer package without repository access', () => {
  const packageRoot = path.join(consumer, 'node_modules/sequelize-guard');
  const detection = JSON.parse(
    execFileSync(
      process.execPath,
      [
        path.join(
          packageRoot,
          'skills/sequelize-guard/references/installed-package.mjs',
        ),
      ],
      { cwd: consumer, env, encoding: 'utf8' },
    ),
  );
  assert.deepEqual(detection, {
    name: 'sequelize-guard',
    version: manifest.version,
    sequelize: manifest.peerDependencies.sequelize,
    root: packageRoot,
    examples: path.join(packageRoot, 'examples'),
    skill: path.join(packageRoot, 'skills/sequelize-guard/SKILL.md'),
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
export async function useRoleHolder(sequelize: Sequelize, Team: ModelStatic<Account>) {
  const guard = new Guard(sequelize, { roleHolders: { team: Team }, sync: false });
  const team = await Team.create({ accountKey: 'team', displayName: 'Team' });
  const result = await guard.assignRolesToHolder(team, ['editor']);
  const assigned: number = result.assigned;
  const editor = await guard.setRoleParent('editor', 'reader');
  await editor.save();
  await guard.setRoleParent('editor', null);
  const allowed: boolean = await guard.holderCan(team, 'read document');
  const roles = await guard.getHolderRoles(team);
  const removed: void = await guard.removeRolesFromHolder(team, ['editor']);
  await migration.addRoleHolders(sequelize.getQueryInterface(), sequelize, { roleHolders: { team: Team } });
  // @ts-expect-error Parent names are strings or null, rather than numeric keys.
  await guard.setRoleParent('editor', 1);
  // @ts-expect-error Holder role reads return plain data.
  await roles[0].save();
  // @ts-expect-error Role holder registrations require model classes.
  new Guard(sequelize, { roleHolders: { team } });
  // @ts-expect-error A holder must be a model instance.
  await guard.assignRolesToHolder(Team, ['editor']);
  return { assigned, allowed, removed };
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
      ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'],
      { cwd: consumer, env, stdio: 'inherit' },
    );
  });
}

if (process.env.RELEASE_VERSION) {
  test('tarball manifest matches the release version', () => {
    assert.equal(manifest.version, process.env.RELEASE_VERSION);
  });
}
