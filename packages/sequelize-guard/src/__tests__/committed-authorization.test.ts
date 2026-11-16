import { Sequelize, Transaction } from 'sequelize';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SequelizeGuard, migration } from '../index';

describe('committed authorization on in-memory SQLite', () => {
  const connections: Sequelize[] = [];
  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(
      connections.splice(0).map((connection) => connection.close()),
    );
  });

  async function fixture() {
    const sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
    });
    connections.push(sequelize);
    const guard = new SequelizeGuard(sequelize, { sync: true });
    await guard.ready;
    const user = await guard.makeUser();
    const { role } = await guard.makeRole('reader');
    await user.addRole!(role.id);
    const [permission] = await guard.createPerms('document', 'read');
    return { sequelize, guard, user, role, permission };
  }

  it.each(['commit', 'rollback'] as const)(
    'rejects every check during a paused grant, then observes %s',
    async (outcome) => {
      const { sequelize, guard, user, role, permission } = await fixture();
      const paused = Promise.withResolvers<void>();
      const resume = Promise.withResolvers<void>();
      guard.models().RolePermission.addHook('afterBulkCreate', async () => {
        paused.resolve();
        await resume.promise;
      });
      const transaction = await sequelize.transaction();
      const insert = guard
        .models()
        .RolePermission.bulkCreate(
          [{ role_id: role.id, permission_id: permission.id }],
          { transaction },
        );
      await paused.promise;
      await expect(user.can!('read document')).rejects.toThrow(
        /SQLite transaction/,
      );
      await expect(user.cant!('read document')).rejects.toThrow(
        /SQLite transaction/,
      );
      await expect(user.isA!('reader')).rejects.toThrow(/SQLite transaction/);
      await expect(guard.getUserRoles(user)).rejects.toThrow(
        /SQLite transaction/,
      );
      await expect(guard.getRole('reader')).rejects.toThrow(
        /SQLite transaction/,
      );
      await expect(guard.findPerms({ resource: 'document' })).rejects.toThrow(
        /SQLite transaction/,
      );
      resume.resolve();
      await insert;
      await transaction[outcome]();
      expect(await user.can!('read document')).toBe(outcome === 'commit');
      expect(await user.isA!('reader')).toBe(true);
    },
  );

  it('rejects a read already in flight when a transaction begins', async () => {
    const { sequelize, guard, user } = await fixture();
    const queried = Promise.withResolvers<void>();
    const resume = Promise.withResolvers<void>();
    const original = user.getRoles!.bind(user);
    vi.spyOn(user, 'getRoles').mockImplementationOnce(async (options) => {
      const roles = await original(options);
      queried.resolve();
      await resume.promise;
      return roles;
    });
    const read = guard.getUserRoles(user);
    await queried.promise;
    const transaction = await sequelize.transaction();
    await transaction.rollback();
    resume.resolve();
    await expect(read).rejects.toThrow(/SQLite transaction/);
  });

  it('rejects a raw Sequelize transaction started through a captured method', async () => {
    const sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
    });
    connections.push(sequelize);
    const startTransaction = sequelize.transaction.bind(sequelize);
    const guard = new SequelizeGuard(sequelize, { sync: true });
    await guard.ready;
    const user = await guard.makeUser();
    const transaction = await startTransaction();
    await expect(user.isA!('reader')).rejects.toThrow(/SQLite transaction/);
    await transaction.rollback();
    expect(await user.isA!('reader')).toBe(false);
  });
  it('rejects malformed requests and grants', async () => {
    const { guard, user, role, permission } = await fixture();
    await guard.models().RolePermission.create({
      role_id: role.id,
      permission_id: permission.id,
    });
    expect(await user.can!('read document')).toBe(true);
    for (const request of [
      'read  document',
      'read document extra',
      'read\tdocument',
      'READ document',
    ]) {
      expect(await user.can!(request)).toBe(false);
    }
    await permission.update({ action: '["read", 42]' });
    expect(await user.can!('read document')).toBe(false);
    await permission.update({ action: '{broken' });
    expect(await user.can!('read document')).toBe(false);
  });

  it('observes direct Transaction preparation through Sequelize SQL', async () => {
    const { sequelize, user } = await fixture();
    const transaction = new Transaction(sequelize, {});
    await (
      transaction as Transaction & {
        prepareEnvironment: () => Promise<void>;
      }
    ).prepareEnvironment();
    await expect(user.isA!('reader')).rejects.toThrow(/SQLite transaction/);
    await transaction.rollback();
    expect(await user.isA!('reader')).toBe(true);
  });

  it('rejects pending membership and grants when constructed inside an older transaction', async () => {
    const sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
    });
    connections.push(sequelize);
    await migration.up(sequelize.getQueryInterface(), sequelize);
    await sequelize.query('INSERT INTO guard_users DEFAULT VALUES');
    await sequelize.query("INSERT INTO guard_roles (name) VALUES ('reader')");
    await sequelize.query(
      "INSERT INTO guard_permissions (name, action, resource) VALUES ('read document', '[\"read\"]', 'document')",
    );
    const transaction = await sequelize.transaction();
    await sequelize.query(
      'INSERT INTO guard_role_user (role_id, user_id) VALUES (1, 1)',
      { transaction },
    );
    await sequelize.query(
      'INSERT INTO guard_role_permission (role_id, permission_id) VALUES (1, 1)',
      { transaction },
    );
    const guard = new SequelizeGuard(sequelize, { sync: false });
    await guard.ready;
    const user = guard
      .models()
      .GuardUser.build({ id: 1 }, { isNewRecord: false });
    await expect(user.can!('read document')).rejects.toThrow(
      /SQLite transaction/,
    );
    await expect(user.isA!('reader')).rejects.toThrow(/SQLite transaction/);
    await transaction.rollback();
    expect(await user.can!('read document')).toBe(false);
    expect(await user.isA!('reader')).toBe(false);
  });

  it('authorizes persisted legacy single-token grants containing slashes', async () => {
    const { guard, user, role } = await fixture();
    const [permission] = await guard.createPerms('posts/42', 'read/item');
    await guard.models().RolePermission.create({
      role_id: role.id,
      permission_id: permission.id,
    });
    expect(await user.can!('read/item posts/42')).toBe(true);
  });

  it('tracks captured raw SQL with comments, savepoints, partial rollback and END', async () => {
    const sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
    });
    connections.push(sequelize);
    const rawQuery = sequelize.query.bind(sequelize);
    await migration.up(sequelize.getQueryInterface(), sequelize);
    await rawQuery('INSERT INTO guard_users DEFAULT VALUES');
    await rawQuery("INSERT INTO guard_roles (name) VALUES ('reader')");
    const guard = new SequelizeGuard(sequelize, { sync: false });
    const user = guard
      .models()
      .GuardUser.build({ id: 1 }, { isNewRecord: false });
    expect(await user.isA!('reader')).toBe(false);

    await rawQuery('/* pending grant */ SAVEPOINT outer_policy');
    await rawQuery(
      'INSERT INTO guard_role_user (role_id, user_id) VALUES (1, 1)',
    );
    await expect(user.isA!('reader')).rejects.toThrow(/SQLite transaction/);
    await rawQuery('ROLLBACK TRANSACTION TO SAVEPOINT outer_policy');
    await expect(user.isA!('reader')).rejects.toThrow(/SQLite transaction/);
    await rawQuery('RELEASE SAVEPOINT outer_policy');
    expect(await user.isA!('reader')).toBe(false);

    await rawQuery('BEGIN');
    await rawQuery(
      'INSERT INTO guard_role_user (role_id, user_id) VALUES (1, 1)',
    );
    await expect(user.isA!('reader')).rejects.toThrow(/SQLite transaction/);
    await rawQuery('END');
    expect(await user.isA!('reader')).toBe(true);
  });

  it('does not roll back a standalone write arriving during the first-read probe', async () => {
    const sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
    });
    connections.push(sequelize);
    await migration.up(sequelize.getQueryInterface(), sequelize);
    await sequelize.query('INSERT INTO guard_users DEFAULT VALUES');
    await sequelize.query("INSERT INTO guard_roles (name) VALUES ('reader')");
    const guard = new SequelizeGuard(sequelize, { sync: false });
    const user = guard
      .models()
      .GuardUser.build({ id: 1 }, { isNewRecord: false });
    const probeStarted = Promise.withResolvers<void>();
    const releaseProbe = Promise.withResolvers<void>();
    sequelize.addHook('afterQuery', async (_options, query) => {
      if (
        (query as typeof query & { sql?: string }).sql?.startsWith(
          'BEGIN DEFERRED',
        )
      ) {
        probeStarted.resolve();
        await releaseProbe.promise;
      }
    });
    const check = user.isA!('reader');
    await probeStarted.promise;
    const write = sequelize.query(
      'INSERT INTO guard_role_user (role_id, user_id) VALUES (1, 1)',
    );
    releaseProbe.resolve();
    await check;
    await write;
    expect(await user.isA!('reader')).toBe(true);
  });
});
