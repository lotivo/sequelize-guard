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
export async function useGuard(sequelize: Sequelize, options: GuardOptions) {
  const guard: SequelizeGuard = new Guard(sequelize, options);
  await guard.ready;
  const synced: SequelizeGuard = await guard.sync({ logging: false, alter: { drop: false } });
  // @ts-expect-error Sync options follow Sequelize's types.
  await guard.sync({ force: 'yes' });
  await guard.allow('reader', ['read'], 'document');
  await guard.init().allow('editor').to('edit').on('document').commit();
  const user = await guard.makeUser();
  await guard.assignRole(user, 'reader');
  const allowed: boolean = await guard.userCan(user, 'read document');
  const roles = await guard.getUserRoles(user);
  const cache = await guard.getCache();
  await migration.up(sequelize.getQueryInterface(), sequelize);
  // @ts-expect-error Role names must be strings.
  await guard.assignRole(user, 123);
  // @ts-expect-error Permission checks return booleans.
  const wrong: string = await guard.userCan(user, 'read document');
  return { allowed, roles, cache, synced };
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
