import { DataTypes, Model, Sequelize } from 'sequelize';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from 'vitest';
import { SequelizeGuard } from '../index';
import type { GuardModel, GuardUserModel } from '../sequelize-models';

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

  it('does no database work when automatic synchronization is disabled', async () => {
    const query = vi.spyOn(sequelize, 'query');
    const guard = new SequelizeGuard(sequelize, { sync: false });
    await guard.ready;
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects duplicate guards and registry conflicts without replacing models', async () => {
    const guard = new SequelizeGuard(sequelize, { sync: false });
    await guard.ready;
    expect(() => new SequelizeGuard(sequelize, { sync: false })).toThrow(
      'already has a guard',
    );
    expect(sequelize.models.GuardModels).toBe(guard.models());
    delete (sequelize as Sequelize & { guard?: SequelizeGuard }).guard;
    expect(() => new SequelizeGuard(sequelize, { sync: false })).toThrow(
      'already has a guard',
    );
    await sequelize.authenticate();
  });

  it('rejects invalid options and model collisions before defining guard models', () => {
    expect(
      () => new SequelizeGuard(sequelize, { primaryKey: 'other', sync: false }),
    ).toThrow('primaryKey');
    expect(sequelize.models.GuardRole).toBeUndefined();
    sequelize.define(
      'ApplicationRole',
      { name: DataTypes.STRING },
      { tableName: 'guard_roles' },
    );
    expect(() => new SequelizeGuard(sequelize, { sync: false })).toThrow(
      'conflicts',
    );
    expect(sequelize.models.GuardRole).toBeUndefined();
  });

  it('rejects invalid custom users before creating guard models or associations', async () => {
    const foreign = new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
    });
    try {
      const UserModel = foreign.define('ForeignUser', {
        key: { type: DataTypes.STRING, primaryKey: true },
      });
      expect(
        () =>
          new SequelizeGuard(sequelize, {
            sync: false,
            UserModel,
          }),
      ).toThrow('this Sequelize instance');
      expect(sequelize.models.GuardRole).toBeUndefined();
      const local = sequelize.define('LocalUser', {
        key: { type: DataTypes.STRING, primaryKey: true },
      });
      expect(
        () =>
          new SequelizeGuard(sequelize, {
            sync: false,
            UserModel: local,
            userPk: 'wrong',
          }),
      ).toThrow('primary key');
      expect(sequelize.models.GuardRole).toBeUndefined();
    } finally {
      await foreign.close();
    }
  });

  it('rejects a custom user method collision before adding associations', () => {
    const UserModel = sequelize.define('Account', {
      id: { type: DataTypes.INTEGER, primaryKey: true },
    });
    Object.defineProperty(UserModel.prototype, 'getRoles', {
      value: () => [],
      configurable: true,
    });
    expect(
      () => new SequelizeGuard(sequelize, { sync: false, UserModel }),
    ).toThrow('getRoles');
    expect(UserModel.associations.Roles).toBeUndefined();
    expect(sequelize.models.GuardRole).toBeUndefined();
  });

  it('binds a string custom user key to the junction and forwards explicit sync options', async () => {
    class Account extends Model {
      declare accountKey: string;
    }
    const UserModel = sequelize.define<Account>('Account', {
      accountKey: {
        type: DataTypes.STRING,
        primaryKey: true,
        field: 'account_key',
      },
    });
    const guard = new SequelizeGuard(sequelize, {
      sync: false,
      UserModel,
      userPk: 'accountKey',
    });
    expectTypeOf(guard.models().GuardUser).toEqualTypeOf<typeof UserModel>();
    expectTypeOf(guard.userCan).parameter(0).toEqualTypeOf<Account>();
    await guard.ready;
    const sync = vi.spyOn(UserModel, 'sync');
    await guard.sync({ alter: true });
    expect(sync).toHaveBeenCalledWith(expect.objectContaining({ alter: true }));
    expect(guard.models().RoleUser.getAttributes().user_id.type).toBeInstanceOf(
      DataTypes.STRING,
    );
    await guard.allow('reader', 'read', 'document');
    const account = await UserModel.create({ accountKey: 'alice' });
    await guard.assignRole(account, 'reader');
    await expect(guard.userCan(account, 'read document')).resolves.toBe(true);
    await guard.sync({ force: true });
    expect(sync).toHaveBeenCalledWith(expect.objectContaining({ force: true }));
    await sequelize.authenticate();
  });

  it('rejects changed model bindings before destructive sync or SQL', async () => {
    const guard = new SequelizeGuard(sequelize, { sync: false });
    const query = vi.spyOn(sequelize, 'query');
    guard.models().GuardRole.options.tableName = 'wrong_table';
    await expect(guard.sync({ force: true })).rejects.toThrow(
      'binding changed',
    );
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects direct permission reads and writes after a model binding changes, before SQL', async () => {
    const guard = new SequelizeGuard(sequelize);
    await guard.ready;
    const query = vi.spyOn(sequelize, 'query');
    Object.defineProperty(guard.models().GuardPermission, 'tableName', {
      value: 'redirected_permissions',
      configurable: true,
    });
    await expect(guard.findPerms()).rejects.toThrow('binding changed');
    await expect(guard.createPerms('document', 'read')).rejects.toThrow(
      'binding changed',
    );
    await expect(
      guard.createPermsBulk([{ resource: 'document', actions: 'read' }]),
    ).rejects.toThrow('binding changed');
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects direct role reads and deletion after a model binding changes, before SQL', async () => {
    const guard = new SequelizeGuard(sequelize);
    await guard.ready;
    const user = await guard.makeUser();
    const query = vi.spyOn(sequelize, 'query');
    Object.defineProperty(guard.models().GuardRole, 'tableName', {
      value: 'redirected_roles',
      configurable: true,
    });
    await expect(guard.findRoles()).rejects.toThrow('binding changed');
    await expect(guard.allRoles()).rejects.toThrow('binding changed');
    await expect(guard.getRole('reader')).rejects.toThrow('binding changed');
    await expect(guard.makeRole('reader')).rejects.toThrow('binding changed');
    await expect(guard.makeRoles(['reader'])).rejects.toThrow('binding changed');
    await expect(user.roles!()).rejects.toThrow('binding changed');
    await expect(guard.deleteRoles('reader')).rejects.toThrow(
      'binding changed',
    );
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects a replaced model collection entry before the first SQLite authorization query', async () => {
    const replacement = sequelize.define('UnrelatedRole', {});
    const guard = new SequelizeGuard(sequelize, { sync: false });
    await guard.ready;
    Reflect.set(guard.models(), 'GuardRole', replacement);
    const query = vi.spyOn(sequelize, 'query');
    await expect(guard.findRoles()).rejects.toThrow('registry binding changed');
    await expect(guard.createPerms('document', 'read')).rejects.toThrow(
      'registry binding changed',
    );
    expect(query).not.toHaveBeenCalled();
  });

  it('rechecks the model binding after entering the committed read barrier', async () => {
    const replacement = sequelize.define('UnrelatedRole', {});
    const guard = new SequelizeGuard(sequelize);
    await guard.ready;
    const query = vi.spyOn(sequelize, 'query');
    const pending = guard.findRoles();
    Reflect.set(guard.models(), 'GuardRole', replacement);
    await expect(pending).rejects.toThrow('registry binding changed');
    expect(query).not.toHaveBeenCalled();
  });

  it('allows an application model with the guard table name in another schema', async () => {
    await sequelize.close();
    sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
      define: { schema: 'tenant' },
    });
    sequelize.define(
      'OtherRole',
      { value: DataTypes.STRING },
      { schema: 'other', tableName: 'guard_roles' },
    );
    expect(() => new SequelizeGuard(sequelize, { sync: false })).not.toThrow();
  });

  it('rejects an application model with the guard table name in the same schema', async () => {
    await sequelize.close();
    sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
      define: { schema: 'tenant' },
    });
    sequelize.define(
      'OtherRole',
      { value: DataTypes.STRING },
      { schema: 'tenant', tableName: 'guard_roles' },
    );
    expect(() => new SequelizeGuard(sequelize, { sync: false })).toThrow(
      'conflicts',
    );
    expect(sequelize.models.GuardRole).toBeUndefined();
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
