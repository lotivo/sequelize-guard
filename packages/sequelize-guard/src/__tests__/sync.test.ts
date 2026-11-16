import { DataTypes, Sequelize } from 'sequelize';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SequelizeGuard } from '../index';
import migration from '../migrations/guard-migrations';
import type { GuardModel, GuardUserModel } from '../sequelize-models';
import { GuardCache } from '../utils/cache';

describe('Guard synchronization', () => {
  let sequelize: Sequelize;

  beforeEach(() => {
    sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await sequelize.close();
  });

  it('stores Sequelize models without cloning connection internals', async () => {
    const guard = new SequelizeGuard(sequelize);
    await guard.ready;
    const role = await guard.models().GuardRole.create({ name: 'reader' });
    Object.defineProperty(role, 'transport', {
      value: Object.freeze({ writeQueueSize: 0 }),
      enumerable: true,
    });
    const cache = new GuardCache();
    expect(() => cache.setRoles({ [role.id]: role })).not.toThrow();
    expect(cache.getRoles()[role.id]).toBe(role);
  });

  it('does no database work when automatic synchronization is disabled', async () => {
    const query = vi.spyOn(sequelize, 'query');
    const guard = new SequelizeGuard(sequelize, { sync: false });
    await guard.ready;
    expect(query).not.toHaveBeenCalled();
  });

  it('refuses a partial same-name schema before creating or dropping tables', async () => {
    const query = sequelize.getQueryInterface();
    await query.createTable('guard_roles', {
      id: { type: DataTypes.INTEGER, primaryKey: true },
      name: { type: DataTypes.STRING },
    });
    await query.bulkInsert('guard_roles', [
      { id: 41, name: 'application data' },
    ]);
    const guard = new SequelizeGuard(sequelize, { sync: false });
    await guard.ready;
    await expect(guard.getRole('reader')).rejects.toThrow(
      'Incomplete legacy Guard schema',
    );
    const drop = vi.spyOn(query, 'dropTable');
    const sync = vi.spyOn(guard.models().GuardResource, 'sync');
    await expect(guard.sync({ force: true })).rejects.toThrow(
      'Incomplete legacy Guard schema',
    );
    expect(drop).not.toHaveBeenCalled();
    expect(sync).not.toHaveBeenCalled();
    expect(await query.showAllTables()).toEqual(['guard_roles']);
    expect(await query.select(null, 'guard_roles')).toEqual([
      { id: 41, name: 'application data' },
    ]);
  });

  it('refuses coincidentally named unrelated tables before destructive sync', async () => {
    const query = sequelize.getQueryInterface();
    for (const name of [
      'guard_resources',
      'guard_permissions',
      'guard_roles',
      'guard_users',
      'guard_role_permission',
      'guard_role_user',
    ]) {
      await query.createTable(name, {
        id: { type: DataTypes.INTEGER, primaryKey: true },
        payload: { type: DataTypes.STRING },
      });
    }
    await query.bulkInsert('guard_roles', [{ id: 41, payload: 'keep' }]);
    const guard = new SequelizeGuard(sequelize, { sync: false });
    const drop = vi.spyOn(query, 'dropTable');
    await expect(guard.sync({ force: true })).rejects.toThrow(
      'Incompatible legacy Guard table',
    );
    expect(drop).not.toHaveBeenCalled();
    expect(await query.select(null, 'guard_roles')).toEqual([
      { id: 41, payload: 'keep' },
    ]);
  });

  it('refuses rollback of a partial legacy schema without dropping its tables', async () => {
    const query = sequelize.getQueryInterface();
    await query.createTable('guard_roles', {
      id: { type: DataTypes.INTEGER, primaryKey: true },
      payload: DataTypes.STRING,
    });
    await query.bulkInsert('guard_roles', [{ id: 41, payload: 'keep' }]);
    const drop = vi.spyOn(query, 'dropTable');
    await expect(migration.down(query, sequelize)).rejects.toThrow(
      'Incomplete legacy Guard schema',
    );
    expect(drop).not.toHaveBeenCalled();
    expect(await query.select(null, 'guard_roles')).toEqual([
      { id: 41, payload: 'keep' },
    ]);
  });

  it('refuses migration creation around an existing same-name table', async () => {
    const query = sequelize.getQueryInterface();
    await query.createTable('guard_roles', {
      id: { type: DataTypes.INTEGER, primaryKey: true },
      payload: DataTypes.STRING,
    });
    const create = vi.spyOn(query, 'createTable');
    await expect(migration.up(query, sequelize)).rejects.toThrow(
      'Guard migration target table already exists',
    );
    expect(create).not.toHaveBeenCalled();
    expect(await query.showAllTables()).toEqual(['guard_roles']);
  });

  it('awaits all guard models and forwards sync options without syncing unrelated models', async () => {
    const unrelated = sequelize.define('Unrelated', {
      value: DataTypes.STRING,
    });
    const unrelatedSync = vi.spyOn(unrelated, 'sync');
    const guard = new SequelizeGuard(sequelize, { sync: false });
    const logging = vi.fn();
    const options = { logging, hooks: false, alter: { drop: false } };
    const syncs = Object.values(guard.models()).map((model) =>
      vi.spyOn(model, 'sync'),
    );

    await expect(guard.sync(options)).resolves.toBe(guard);
    for (const sync of syncs) expect(sync).toHaveBeenCalledWith(options);
    expect(logging).toHaveBeenCalled();
    expect(unrelatedSync).not.toHaveBeenCalled();
    await guard.allow('reader', 'read', 'document');
    const user = await guard.makeUser();
    await guard.assignRole(user, 'reader');
    await expect(guard.userCan(user, 'read document')).resolves.toBe(true);
  });

  it('rejects ready when automatic model synchronization fails', async () => {
    const failure = new Error('schema unavailable');
    const guard = new SequelizeGuard(sequelize);
    vi.spyOn(guard.models().GuardResource, 'sync').mockRejectedValueOnce(
      failure,
    );
    await expect(guard.ready).rejects.toBe(failure);
    await expect(guard.sync()).resolves.toBe(guard);
  });

  it('rejects ready when cache initialization fails and permits retry', async () => {
    const failure = new Error('policy query failed');
    const guard = new SequelizeGuard(sequelize);
    vi.spyOn(guard.models().GuardPermission, 'findAll').mockRejectedValueOnce(
      failure,
    );
    await expect(guard.ready).rejects.toBe(failure);
    await expect(guard.sync()).resolves.toBe(guard);
    await guard.makeRole('reader');
    expect((await guard.allRoles()).map((role) => role.name)).toEqual([
      'reader',
    ]);
  });

  it('rejects explicit sync errors without running dependent model syncs', async () => {
    const guard = new SequelizeGuard(sequelize, { sync: false });
    const failure = new Error('create table failed');
    vi.spyOn(guard.models().GuardRole, 'sync').mockRejectedValueOnce(failure);
    const junction = vi.spyOn(guard.models().RolePermission, 'sync');
    await expect(guard.sync()).rejects.toBe(failure);
    expect(junction).not.toHaveBeenCalled();
    await expect(guard.sync()).resolves.toBe(guard);
  });

  it('refreshes cached policy after force sync without duplicating event listeners', async () => {
    const unrelated = sequelize.define('Unrelated', {
      value: DataTypes.STRING,
    });
    await unrelated.sync();
    await unrelated.create({ value: 'keep me' });
    const guard = new SequelizeGuard(sequelize);
    await guard.ready;
    await guard.allow('reader', 'read', 'document');
    const user = await guard.makeUser();
    await guard.assignRole(user, 'reader');
    const cache = await guard.getCache();
    const listeners = guard._ee.listenerCount('onRolesCreated');

    await guard.sync({ force: true });
    expect(await guard.allRoles()).toEqual([]);
    expect(cache.getPerms()).toEqual({});
    expect(await unrelated.count()).toBe(1);
    expect(guard._ee.listenerCount('onRolesCreated')).toBe(listeners);
    expect((await guard.makeRole('reader')).created).toBe(true);
    expect((await guard.allRoles()).map((role) => role.name)).toEqual([
      'reader',
    ]);
  });

  it('enforces the database name match before destructive synchronization', async () => {
    const guard = new SequelizeGuard(sequelize);
    await guard.ready;
    await guard.makeRole('keep');
    const query = vi.spyOn(sequelize, 'query');
    await expect(
      guard.sync({ force: true, match: /^never_matches$/ }),
    ).rejects.toThrow('does not match');
    expect(query).not.toHaveBeenCalled();
    expect(await guard.models().GuardRole.count()).toBe(1);
  });

  it.each([{}, { force: true }, { alter: true }])(
    'rejects a schema override before any database work (%j)',
    async (options) => {
      const guard = new SequelizeGuard(sequelize);
      await guard.ready;
      await guard.makeRole('keep');
      const query = vi.spyOn(sequelize, 'query');
      await expect(guard.sync({ ...options, schema: 'other' })).rejects.toThrow(
        'schema',
      );
      expect(query).not.toHaveBeenCalled();
      expect(await guard.models().GuardRole.count()).toBe(1);
    },
  );

  it('accepts a schema already bound to every guard model', async () => {
    await sequelize.close();
    sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
      define: { schema: 'tenant' },
    });
    const guard = new SequelizeGuard(sequelize, { sync: false });
    await expect(guard.sync({ schema: 'tenant' })).resolves.toBe(guard);
    await guard.makeRole('reader');
    expect(await guard.models().GuardRole.count()).toBe(1);
    await guard.sync({ schema: 'tenant', force: true });
    await guard.allow('reader', 'read', 'document');
    const user = await guard.makeUser();
    await guard.assignRole(user, 'reader');
    await expect(guard.userCan(user, 'read document')).resolves.toBe(true);
  });

  it('rejects schema changes before creating any tables', async () => {
    const guard = new SequelizeGuard(sequelize, { sync: false });
    const query = vi.spyOn(sequelize, 'query');
    await expect(guard.sync({ schema: 'tenant' })).rejects.toThrow('schema');
    expect(query).not.toHaveBeenCalled();
  });

  it('validates the custom user model schema before any drops', async () => {
    await sequelize.close();
    sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
      define: { schema: 'tenant' },
    });
    const UserModel = sequelize.define<GuardUserModel>(
      'CustomUser',
      {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      },
      { schema: 'users' },
    );
    const guard = new SequelizeGuard(sequelize, { sync: false, UserModel });
    const query = vi.spyOn(sequelize, 'query');
    await expect(guard.sync({ schema: 'tenant', force: true })).rejects.toThrow(
      'schema',
    );
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects per-call PostgreSQL searchPath routing before database work', async () => {
    await sequelize.close();
    sequelize = new Sequelize({
      dialect: 'postgres',
      database: 'guard',
      dialectModule: {},
      logging: false,
      dialectOptions: { prependSearchPath: true },
    });
    const guard = new SequelizeGuard(sequelize, { sync: false });
    const query = vi.spyOn(sequelize, 'query');
    await expect(
      guard.sync({ searchPath: 'tenant', force: true }),
    ).rejects.toThrow('searchPath');
    expect(query).not.toHaveBeenCalled();
  });

  it('queues explicit synchronization behind automatic startup', async () => {
    const started = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const guard = new SequelizeGuard(sequelize);
    const model = guard.models().GuardResource;
    model.addHook('beforeSync', async () => {
      started.resolve();
      await release.promise;
    });
    const sync = vi.spyOn(model, 'sync');
    const second = guard.sync();
    await started.promise;
    try {
      expect(sync).toHaveBeenCalledTimes(1);
    } finally {
      release.resolve();
      await Promise.all([guard.ready, second]);
    }
    expect(sync).toHaveBeenCalledTimes(2);
  });

  it('makes concurrent cache readers await the same initialization', async () => {
    const guard = new SequelizeGuard(sequelize, { sync: false });
    const models: GuardModel[] = Object.values(guard.models());
    for (const model of models) await model.sync();
    await guard.models().GuardRole.create({ name: 'reader' });
    const started = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const roles = guard.models().GuardRole;
    const findAll = roles.findAll.bind(roles);
    vi.spyOn(roles, 'findAll').mockImplementationOnce(async (options) => {
      started.resolve();
      await release.promise;
      return findAll(options);
    });
    const first = guard.getCache();
    await started.promise;
    const second = guard
      .getCache()
      .then((cache) =>
        Object.values(cache.getRoles()).map((role) => role.name),
      );
    // Let an incorrectly resolved second read observe the unfinished cache.
    await new Promise<void>((resolve) => setImmediate(resolve));
    release.resolve();
    await first;
    expect(await second).toEqual(['reader']);
    expect(roles.findAll).toHaveBeenCalledTimes(1);
  });

  it('does not restore an in-flight cache snapshot after a reset', async () => {
    const guard = new SequelizeGuard(sequelize);
    await guard.ready;
    await guard.makeRole('old');
    guard.resetCache();
    const started = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const roles = guard.models().GuardRole;
    const findAll = roles.findAll.bind(roles);
    vi.spyOn(roles, 'findAll').mockImplementationOnce(async (options) => {
      const snapshot = await findAll(options);
      started.resolve();
      await release.promise;
      return snapshot;
    });
    const pending = guard.getCache();
    await started.promise;
    try {
      await roles.destroy({ where: { name: 'old' } });
      await roles.create({ name: 'new' });
      guard.resetCache();
      await guard.getCache();
    } finally {
      release.resolve();
    }
    const cache = await pending;
    expect(Object.values(cache.getRoles()).map((role) => role.name)).toEqual([
      'new',
    ]);
  });

  it('propagates cache errors and retries instead of returning an empty cache', async () => {
    const guard = new SequelizeGuard(sequelize, { sync: false });
    await guard.ready;
    await expect(guard.getCache()).rejects.toThrow();
    const models: GuardModel[] = Object.values(guard.models());
    for (const model of models) await model.sync();
    await guard.models().GuardRole.create({ name: 'reader' });
    expect((await guard.allRoles()).map((role) => role.name)).toEqual([
      'reader',
    ]);
  });
});
