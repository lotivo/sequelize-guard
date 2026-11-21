import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DataTypes, Sequelize, type ModelStatic } from 'sequelize';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { SequelizeGuard } from '../index';
import type { GuardUserModel } from '../sequelize-models';
import { cleanupDbFile, generateDbPath } from './utils/db-utils';

const fixture = resolve(
  dirname(fileURLToPath(import.meta.url)),
  'fixtures/sequelize-guard-6.0.3.tgz',
);
type PublishedPackage = {
  SequelizeGuard: typeof SequelizeGuard;
  migration: typeof SequelizeGuard.migration;
};

describe('published npm 6.0.3 database compatibility', () => {
  let fixtureDir: string;
  let published: PublishedPackage;

  beforeAll(() => {
    expect(createHash('sha1').update(readFileSync(fixture)).digest('hex')).toBe(
      'e748c89a5f9d11f3dd11de66ef56ffd4a5160991',
    );
    fixtureDir = mkdtempSync(join(tmpdir(), 'sequelize-guard-603-'));
    execFileSync('tar', ['-xzf', fixture, '-C', fixtureDir]);
    // Resolve the artifact's peer dependencies from this test's locked install.
    const dependencyRoot = resolve(
      dirname(createRequire(import.meta.url).resolve('lodash')),
      '..',
    );
    symlinkSync(dependencyRoot, join(fixtureDir, 'node_modules'), 'dir');
    const packagePath = join(fixtureDir, 'package');
    const metadata = JSON.parse(
      readFileSync(join(packagePath, 'package.json'), 'utf8'),
    ) as { version: string };
    expect(metadata.version).toBe('6.0.3');
    published = createRequire(import.meta.url)(
      join(packagePath, 'dist/cjs/index.cjs'),
    ) as PublishedPackage;
  });

  afterAll(() => rmSync(fixtureDir, { recursive: true, force: true }));

  for (const creation of ['sync', 'migration'] as const) {
    for (const customUser of [false, true]) {
      for (const { timestamps, paranoid } of [
        { timestamps: false, paranoid: false },
        { timestamps: true, paranoid: false },
        { timestamps: true, paranoid: true },
      ]) {
        for (const sync of [true, false]) {
          it(`${creation}, ${customUser ? 'custom' : 'built-in'} user, timestamps ${timestamps}, paranoid ${paranoid}, sync ${sync}`, async () => {
            const dbPath = generateDbPath('published_603');
            const config = {
              dialect: 'sqlite' as const,
              storage: dbPath,
              logging: false,
            };
            const opts = { timestamps, paranoid };
            let previousDb = new Sequelize(config);
            let currentDb: Sequelize | undefined;
            try {
              const previousUser = customUser
                ? (previousDb.define(
                    'Account',
                    {
                      id: { type: DataTypes.INTEGER, primaryKey: true },
                      label: { type: DataTypes.STRING, allowNull: false },
                    },
                    { tableName: 'accounts', timestamps: false },
                  ) as unknown as ModelStatic<GuardUserModel>)
                : undefined;
              if (previousUser) await previousUser.sync();
              const previousOpts = { ...opts, UserModel: previousUser };
              if (creation === 'sync') {
                const old = new published.SequelizeGuard(
                  previousDb,
                  previousOpts,
                );
                await old.ready;
              } else {
                await published.migration.up(
                  previousDb.getQueryInterface(),
                  previousDb,
                  previousOpts,
                );
              }
              const oldTables = await previousDb
                .getQueryInterface()
                .showAllTables();
              const userTable = customUser ? 'accounts' : 'guard_users';
              expect(oldTables).toContain(userTable);
              const dateColumns = timestamps
                ? creation === 'sync'
                  ? {
                      createdAt: '2024-06-02 12:00:00.000 +00:00',
                      updatedAt: '2024-06-02 12:00:00.000 +00:00',
                      ...(paranoid ? { deletedAt: null } : {}),
                    }
                  : {
                      created_at: '2024-06-02 12:00:00.000 +00:00',
                      updated_at: '2024-06-02 12:00:00.000 +00:00',
                      ...(paranoid ? { deleted_at: null } : {}),
                    }
                : {};
              const query = previousDb.getQueryInterface();
              await query.bulkInsert('guard_resources', [
                {
                  id: 7,
                  name: 'article',
                  description: 'Original resource',
                  ...dateColumns,
                },
              ]);
              await query.bulkInsert(userTable, [
                {
                  id: 12,
                  ...(customUser ? { label: 'Retained' } : dateColumns),
                },
              ]);
              await query.bulkInsert('guard_roles', [
                {
                  id: 31,
                  name: 'reader',
                  description: 'Original',
                  parent_id: 32,
                  ...dateColumns,
                },
                { id: 32, name: 'parent', ...dateColumns },
              ]);
              await query.bulkInsert('guard_permissions', [
                {
                  id: 11,
                  name: 'read article',
                  resource: 'article',
                  action: '["read"]',
                  allow: 1,
                  ...dateColumns,
                },
                {
                  id: 13,
                  name: 'approve article',
                  resource: 'article',
                  action: '["approve"]',
                  allow: 1,
                  ...dateColumns,
                },
              ]);
              await query.bulkInsert('guard_role_permission', [
                { id: 18, role_id: 31, permission_id: 11, ...dateColumns },
                { id: 19, role_id: 32, permission_id: 13, ...dateColumns },
              ]);
              await query.bulkInsert('guard_role_user', [
                { id: 27, role_id: 31, user_id: 12, ...dateColumns },
              ]);
              await previousDb.close();
              currentDb = new Sequelize(config);
              const currentUser = customUser
                ? (currentDb.define(
                    'Account',
                    {
                      id: { type: DataTypes.INTEGER, primaryKey: true },
                      label: { type: DataTypes.STRING, allowNull: false },
                    },
                    { tableName: 'accounts', timestamps: false },
                  ) as unknown as ModelStatic<GuardUserModel>)
                : undefined;
              const querySpy = vi.spyOn(currentDb, 'query');
              const guard = new SequelizeGuard(currentDb, {
                ...opts,
                UserModel: currentUser,
                sync,
              });
              await guard.ready;
              if (!sync) expect(querySpy).not.toHaveBeenCalled();
              const user = await guard
                .models()
                .GuardUser.findByPk(12, { rejectOnEmpty: true });
              expect(await guard.userCan(user, 'read article')).toBe(true);
              expect(await guard.userCan(user, 'edit article')).toBe(false);
              expect(await guard.userCan(user, 'approve article')).toBe(false);
              const role = await guard.models().GuardRole.findByPk(31);
              expect(role?.parent_id).toBe(32);
              expect(role?.description).toBe('Original');
              if (timestamps)
                expect(role?.get('createdAt')).toEqual(
                  new Date('2024-06-02T12:00:00Z'),
                );
              expect(
                (await guard.models().GuardPermission.findByPk(11))?.name,
              ).toBe('read article');
              expect(
                (await guard.models().GuardResource.findByPk(7))?.description,
              ).toBe('Original resource');
              if (customUser) expect(user.get('label')).toBe('Retained');
              expect(
                (
                  await currentDb
                    .getQueryInterface()
                    .select(null, 'guard_role_user', { where: { id: 27 } })
                ).length,
              ).toBe(1);
              await guard.rmPermsFromRole('reader', 'read', 'article');
              expect(await guard.userCan(user, 'read article')).toBe(false);
              await guard.allow('reader', 'read', 'article');
              expect(await guard.userCan(user, 'read article')).toBe(true);
              await guard.allow('reader', 'edit', 'article');
              expect(await guard.userCan(user, 'edit article')).toBe(true);
              await guard.rmPermsFromRole('reader', 'edit', 'article');
              expect(await guard.userCan(user, 'edit article')).toBe(false);
              await guard.assignRole(user, 'parent');
              expect(
                (await guard.getUserRoles(user)).map((role) => role.name),
              ).toContain('parent');
              await guard.rmAssignedRoles(user, ['parent']);
              expect(
                (await guard.getUserRoles(user)).map((role) => role.name),
              ).not.toContain('parent');
            } finally {
              await currentDb?.close();
              if (!currentDb) await previousDb.close();
              cleanupDbFile(dbPath);
            }
          });
        }
      }
    }
  }
});
