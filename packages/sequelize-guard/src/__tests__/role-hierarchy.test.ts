import { Sequelize } from 'sequelize';
import { migration as legacyMigration } from 'sequelize-guard-previous';
import { expect, it, onTestFinished } from 'vitest';
import { SequelizeGuard, migration } from '../index';
import { closeTestDatabase, createTestDatabase } from './setup';
import { cleanupDbFile, generateDbPath } from './utils/db-utils';

async function setup() {
  const context = await createTestDatabase();
  onTestFinished(() => closeTestDatabase(context));
  const connection = new Sequelize({
    dialect: 'sqlite',
    storage: context.dbPath,
    logging: false,
  });
  onTestFinished(() => connection.close());
  const other = new SequelizeGuard(connection, {
    sync: false,
    timestamps: true,
  });
  return { ...context, other };
}

it('inherits current permissions through multiple parents and keeps role checks direct', async () => {
  const { guard, other } = await setup();
  const { role: root } = await guard.makeRole('staff');
  const { role: branch } = await guard.makeRole({
    name: 'editor',
    parent_id: root.id,
  });
  await guard.makeRole({ name: 'junior', parent_id: branch.id });
  await guard.allow('staff', 'read', '*');
  await guard.allow('editor', '*', 'article');
  await guard.allow('junior', 'comment', 'document');
  const user = await guard.makeUser();
  await guard.assignRole(user, 'junior');

  expect(await guard.userCan(user, 'read document')).toBe(true);
  expect(await guard.userCan(user, 'publish article')).toBe(true);
  expect(await guard.userCan(user, 'comment document')).toBe(true);
  expect(await guard.userIsA(user, 'staff')).toBe(false);
  expect(await guard.userHasRoles(user, ['staff', 'editor'])).toBe(false);
  expect((await guard.getUserRoles(user)).map(({ name }) => name)).toEqual([
    'junior',
  ]);

  await other.rmPermsFromRole('staff', 'read', '*');
  expect(await guard.userCan(user, 'read document')).toBe(false);
  expect(await guard.userCan(user, 'publish article')).toBe(true);
  await other.setRoleParent('junior', null);
  expect(await guard.userCan(user, 'publish article')).toBe(false);
  expect(await guard.userCan(user, 'comment document')).toBe(true);
});

it('rejects self-links, cycles, and absent or inactive parents', async () => {
  const { guard } = await setup();
  const { role } = await guard.makeRole('one');
  await guard.makeRole({ name: 'two', parent_id: role.id });
  await expect(guard.setRoleParent('one', 'one')).rejects.toThrow('cycle');
  await expect(guard.setRoleParent('one', 'two')).rejects.toThrow('cycle');
  await expect(
    guard.makeRole({ name: 'one', parent_id: role.id }),
  ).rejects.toThrow('cycle');
  await expect(guard.setRoleParent('one', 'missing')).rejects.toThrow(
    'Parent role does not exist',
  );
  await expect(guard.setRoleParent('missing', 'one')).rejects.toThrow(
    'Child role does not exist',
  );
  await expect(
    guard.makeRole({ name: 'three', parent_id: 9999 }),
  ).rejects.toThrow('Parent role does not exist');
  await expect(guard.deleteRoles('one')).rejects.toThrow('child roles');
  guard.options.safeGuardDeletes = false;
  await expect(guard.deleteRoles('one')).resolves.toBe(1);
  expect((await guard.getRole('two'))?.parent_id).toBeNull();
});

it('prevents concurrent graph edits from forming a cycle', async () => {
  const { guard, other } = await setup();
  await guard.makeRoles(['one', 'two', 'three']);
  await guard.setRoleParent('three', 'two');
  const results = await Promise.allSettled([
    guard.setRoleParent('one', 'three'),
    other.setRoleParent('two', 'one'),
  ]);
  expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(
    1,
  );
  expect(results).toContainEqual(
    expect.objectContaining({
      status: 'rejected',
      reason: expect.objectContaining({
        message: 'Role parent would create a cycle',
      }),
    }),
  );
});

it('fails closed for corrupt cycles and searches deep valid hierarchies in one writer query', async () => {
  const { guard, sequelize } = await setup();
  const chain = await guard
    .models()
    .GuardRole.bulkCreate(
      Array.from({ length: 256 }, (_, index) => ({ name: `role ${index}` })),
    );
  const first = chain[0];
  const last = chain.at(-1)!;
  await guard.allow('role 0', 'read', 'article');
  for (let index = 1; index < chain.length; index++) {
    await chain[index].update({ parent_id: chain[index - 1].id });
  }
  const user = await guard.makeUser();
  await guard.assignRole(user, last.name);
  let queries = 0;
  sequelize.addHook('beforeQuery', 'count-lineage', () => {
    queries++;
  });
  await expect(guard.userCan(user, 'read article')).resolves.toBe(true);
  expect(queries).toBe(1);
  sequelize.removeHook('beforeQuery', 'count-lineage');

  await first.update({ parent_id: last.id });
  await expect(guard.userCan(user, 'read article')).resolves.toBe(false);
  await expect(
    guard.makeRole({ name: 'another', parent_id: first.id }),
  ).rejects.toThrow('contains a cycle');
  await expect(guard.userIsA(user, last.name)).resolves.toBe(true);
});

it('denies stale instances after a user or ancestor is soft-deleted through another connection', async () => {
  const { dbPath } = await setup();
  const options = { prefix: 'paranoid_', timestamps: true, paranoid: true };
  const connect = () =>
    new Sequelize({ dialect: 'sqlite', storage: dbPath, logging: false });
  const first = connect();
  const second = connect();
  onTestFinished(async () => {
    await Promise.all([first.close(), second.close()]);
  });
  const guard = new SequelizeGuard(first, options);
  const other = new SequelizeGuard(second, { ...options, sync: false });
  await guard.ready;
  const { role } = await guard.makeRole('parent');
  await guard.makeRole({ name: 'child', parent_id: role.id });
  await guard.allow('parent', 'read', 'article');
  const user = await guard.makeUser();
  await guard.assignRole(user, 'child');
  expect(await guard.userCan(user, 'read article')).toBe(true);

  await other.models().GuardRole.destroy({ where: { id: role.id } });
  await expect(guard.userCan(user, 'read article')).resolves.toBe(false);
  await expect(guard.setRoleParent('child', 'parent')).rejects.toThrow(
    'Parent role does not exist',
  );
  await guard.setRoleParent('child', null);
  await guard.allow('child', 'read', 'article');
  expect(await guard.userCan(user, 'read article')).toBe(true);

  await other.models().GuardUser.destroy({ where: { id: user.id } });
  await expect(guard.userCan(user, 'read article')).resolves.toBe(false);
  await expect(guard.userIsA(user, 'child')).resolves.toBe(false);
  await expect(guard.getUserRoles(user)).resolves.toEqual([]);
  await expect(user.roles()).resolves.toEqual([]);
  await expect(guard.assignRole(user, 'parent')).rejects.toThrow(
    'no longer exists',
  );
});

it('rejects noncanonical stored role names before allowing inherited access', async () => {
  const { guard } = await setup();
  const { role } = await guard.makeRole('parent');
  await guard.makeRole({ name: 'child', parent_id: role.id });
  await guard.allow('parent', 'read', 'article');
  const user = await guard.makeUser();
  await guard.assignRole(user, 'child');
  expect(await guard.userCan(user, 'read article')).toBe(true);
  await role.update({ name: ' Parent ' });
  await expect(guard.userCan(user, 'read article')).rejects.toThrow(
    'Stored guard role name must be normalized',
  );
  await expect(guard.userIsA(user, 'child')).resolves.toBe(true);
});

it('requires explicit activation of legacy ancestors and rejects an invalid legacy forest before creating destination tables', async () => {
  const storage = generateDbPath('legacy_lineage');
  const connect = () =>
    new Sequelize({ dialect: 'sqlite', storage, logging: false });
  const sequelize = connect();
  const previousConnection = connect();
  onTestFinished(async () => {
    await Promise.all([sequelize.close(), previousConnection.close()]);
    cleanupDbFile(storage);
  });
  const query = sequelize.getQueryInterface();
  const from = { prefix: 'old_', sync: false };
  const to = { ...from, prefix: 'new_' };
  await legacyMigration.up(query, sequelize, from);
  await query.bulkInsert('old_users', [{ id: 1 }]);
  await query.bulkInsert('old_roles', [
    { id: 1, name: 'parent', parent_id: null },
    { id: 2, name: 'child', parent_id: 1 },
  ]);
  await query.bulkInsert('old_permissions', [
    { id: 1, name: 'read document', resource: 'document', action: '["read"]' },
  ]);
  await query.bulkInsert('old_role_permission', [
    { id: 1, role_id: 1, permission_id: 1 },
  ]);
  await query.bulkInsert('old_role_user', [{ id: 1, role_id: 2, user_id: 1 }]);
  const before = await query.showAllTables();

  const oldGuard = new SequelizeGuard(previousConnection, from);
  await oldGuard.ready;
  const oldUser = await oldGuard
    .models()
    .GuardUser.findByPk(1, { rejectOnEmpty: true });
  await expect(oldGuard.userCan(oldUser, 'read document')).rejects.toThrow();
  await expect(oldGuard.sync()).rejects.toThrow('requires migration.upgrade');
  await expect(
    migration.upgrade(query, sequelize, { from, to }),
  ).rejects.toThrow('inheritExistingParents: true');
  expect(await query.showAllTables()).toEqual(before);

  await query.bulkUpdate('old_roles', { parent_id: 2 }, { id: 1 });
  const upgrade = { from, to, inheritExistingParents: true };
  await expect(migration.upgrade(query, sequelize, upgrade)).rejects.toThrow(
    'contains a cycle',
  );
  expect(await query.showAllTables()).toEqual(before);

  await query.bulkUpdate('old_roles', { parent_id: null }, { id: 1 });
  await migration.upgrade(query, sequelize, upgrade);
  const guard = new SequelizeGuard(sequelize, to);
  const user = await guard
    .models()
    .GuardUser.findByPk(1, { rejectOnEmpty: true });
  await expect(guard.userCan(user, 'read document')).resolves.toBe(true);
  await expect(guard.userIsA(user, 'parent')).resolves.toBe(false);
  expect(await query.tableExists('old_roles')).toBe(true);
  expect(await query.tableExists('old_role_hierarchy')).toBe(false);
  await migration.down(query, sequelize, to);
  expect(await query.showAllTables()).toEqual(before);
});
