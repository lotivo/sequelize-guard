import { Sequelize, Transaction } from 'sequelize';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SequelizeGuard } from '../index';

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
    await guard
      .models()
      .RolePermission.create({
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
    await (transaction as Transaction & {
      prepareEnvironment: () => Promise<void>;
    }).prepareEnvironment();
    await expect(user.isA!('reader')).rejects.toThrow(/SQLite transaction/);
    await transaction.rollback();
    expect(await user.isA!('reader')).toBe(true);
  });
});
