import { DataTypes, Sequelize } from 'sequelize';
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

  it('forwards force and alter to the supplied user after removing owned junctions', async () => {
    const UserModel = sequelize.define('Account', { label: DataTypes.STRING });
    const guard = new SequelizeGuard(sequelize, { UserModel });
    await guard.ready;
    const user = await UserModel.create({ label: 'old' });
    await guard.makeRole('reader');
    await guard.assignRole(user, 'reader');
    const sync = vi.spyOn(UserModel, 'sync');
    await guard.sync({ force: true });
    expect(sync).toHaveBeenCalledExactlyOnceWith({
      logging: false,
      force: true,
    });
    expect(await UserModel.count()).toBe(0);
    await UserModel.create({ label: 'new' });
    sync.mockClear();
    await guard.sync({ alter: { drop: false } });
    expect(sync).toHaveBeenCalledExactlyOnceWith({
      logging: false,
      alter: { drop: false },
    });
    expect(await UserModel.count()).toBe(1);
  });

  it('binds schema options before checking ownership and dropping tables', async () => {
    const UserModel = sequelize.define('Account', {});
    const Team = sequelize.define('Team', {});
    const OtherUser = sequelize.define('OtherAccount', {
      accountId: { type: DataTypes.INTEGER, primaryKey: true },
    });
    const OtherTeam = sequelize.define('OtherTeam', {});
    for (const model of [UserModel, Team, OtherUser, OtherTeam]) {
      await model.sync();
    }
    const input = {
      sync: false,
      prefix: 'source_',
      tables: { roles: 'policy' },
      UserModel,
      userPk: 'id',
      roleHolders: { team: Team },
    };
    const destination = {
      prefix: 'destination_',
      tables: { roles: 'policy' },
      UserModel: OtherUser,
      userPk: 'accountId',
      roleHolders: { team: OtherTeam },
    };
    const query = sequelize.getQueryInterface();
    await SequelizeGuard.migration.up(query, sequelize, destination);
    await query.bulkInsert('destination_policy', [
      { name: 'destination-role' },
    ]);

    const guard = new SequelizeGuard(sequelize, input);
    await guard.ready;
    const { GuardRole } = guard.models();
    await GuardRole.sync();
    await GuardRole.create({ name: 'source-role' });

    input.prefix = 'caller_';
    input.tables.roles = 'caller_roles';
    input.roleHolders.team = OtherTeam;
    expect(guard.options.prefix).toBe('source_');
    expect(guard.options.tables.roles).toBe('policy');
    expect(guard.options.roleHolders.team).toBe(Team);
    expect(Object.isFrozen(UserModel)).toBe(false);
    expect(Object.isFrozen(Team)).toBe(false);

    const remapped = [
      Reflect.set(guard.options.tables, 'roles', 'unexpected'),
      Reflect.set(guard.options.roleHolders, 'team', OtherTeam),
      ...Object.entries(destination).map(([name, value]) =>
        Reflect.set(guard.options, name, value),
      ),
      Reflect.set(guard, 'options', { ...guard.options, ...destination }),
    ];
    const execute = vi.spyOn(sequelize, 'query');
    const drop = vi.spyOn(GuardRole, 'drop');
    await expect(guard.sync({ force: true })).rejects.toThrow(
      'has no Guard ownership receipt',
    );
    expect(remapped).toEqual(
      Array.from({ length: remapped.length }, () => false),
    );
    expect(drop).not.toHaveBeenCalled();
    expect(execute.mock.calls.map(([sql]) => sql)).not.toContainEqual(
      expect.stringMatching(/^(?:DROP|ALTER|CREATE) /iu),
    );
    expect(await GuardRole.findOne()).toMatchObject({ name: 'source-role' });
    expect(await query.select(GuardRole, 'destination_policy', {})).toEqual([
      expect.objectContaining({ name: 'destination-role' }),
    ]);

    expectTypeOf<Pick<typeof guard.options, 'prefix'>>().toEqualTypeOf<{
      readonly prefix: string;
    }>();
    expectTypeOf<Pick<typeof guard.options.tables, 'roles'>>().toEqualTypeOf<{
      readonly roles?: string;
    }>();
    guard.options.safeGuardDeletes = false;
    expect(guard.options.safeGuardDeletes).toBe(false);
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

  it.each(['schema', 'define.schema', 'define.schemaDelimiter'])(
    'rejects live Sequelize routing drift before sync or policy access (%s)',
    async (setting) => {
      const guard = new SequelizeGuard(sequelize);
      await guard.ready;
      await guard.allow('reader', 'read', 'document');
      const user = await guard.makeUser();
      await guard.assignRole(user, 'reader');
      const runtime = sequelize as Sequelize & {
        options: {
          schema?: string;
          define: { schema?: string; schemaDelimiter?: string };
        };
      };
      if (setting === 'schema') runtime.options.schema = 'other';
      else if (setting === 'define.schema')
        runtime.options.define.schema = 'other';
      else runtime.options.define.schemaDelimiter = '__';
      const query = vi.spyOn(sequelize, 'query');
      await expect(guard.sync({ force: true })).rejects.toThrow(
        'schema defaults changed',
      );
      await expect(guard.userCan(user, 'read document')).rejects.toThrow(
        'schema defaults changed',
      );
      await expect(guard.assignRole(user, 'reader')).rejects.toThrow(
        'schema defaults changed',
      );
      await expect(guard.createPerms('document', 'write')).rejects.toThrow(
        'schema defaults changed',
      );
      expect(query).not.toHaveBeenCalled();
    },
  );

  it.each(['table', 'key', 'paranoid', 'registration'])(
    'rejects supplied user metadata drift before sync, authorization or writes (%s)',
    async (change) => {
      const UserModel = sequelize.define(
        'Account',
        {},
        { timestamps: true, paranoid: true },
      );
      const guard = new SequelizeGuard(sequelize, { UserModel });
      await guard.ready;
      await guard.allow('reader', 'read', 'document');
      const user = await guard.makeUser();
      await guard.assignRole(user, 'reader');
      if (change === 'table')
        Reflect.set(UserModel, 'tableName', 'other_accounts');
      if (change === 'key') UserModel.getAttributes().id.field = 'other_id';
      if (change === 'paranoid') UserModel.options.paranoid = false;
      if (change === 'registration') sequelize.define('Account', {});
      const query = vi.spyOn(sequelize, 'query');
      await expect(guard.sync({ force: true })).rejects.toThrow(
        'model binding changed',
      );
      await expect(guard.userCan(user, 'read document')).rejects.toThrow(
        'model binding changed',
      );
      await expect(guard.assignRole(user, 'reader')).rejects.toThrow(
        'model binding changed',
      );
      expect(query).not.toHaveBeenCalled();
      expect(Object.isFrozen(UserModel)).toBe(false);
    },
  );

  it('rejects reinitialized registered holder metadata before any query', async () => {
    const Team = sequelize.define('Team', {});
    await Team.sync();
    const guard = new SequelizeGuard(sequelize, {
      roleHolders: { team: Team },
    });
    await guard.ready;
    const team = await Team.create();
    await guard.makeRole('reader');
    await guard.assignRolesToHolder(team, ['reader']);
    Team.init(
      { key: { type: DataTypes.STRING, primaryKey: true } },
      {
        sequelize,
        modelName: 'Team',
        tableName: 'replacement_teams',
      },
    );
    const query = vi.spyOn(sequelize, 'query');
    await expect(guard.sync({ force: true })).rejects.toThrow(
      'model binding changed',
    );
    await expect(guard.holderCan(team, 'read document')).rejects.toThrow(
      'model binding changed',
    );
    await expect(guard.assignRolesToHolder(team, ['reader'])).rejects.toThrow(
      'model binding changed',
    );
    expect(query).not.toHaveBeenCalled();
    expect(Object.isFrozen(Team)).toBe(false);
  });

  it.each(['foreign key', 'index'])(
    'rejects reinitialization at the same table and key with changed %s before alter',
    async (change) => {
      const Parent = sequelize.define('Parent', {}, { timestamps: false });
      await Parent.sync();
      const attributes = {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        parent_id: {
          type: DataTypes.INTEGER,
          references: { model: Parent, key: 'id' },
          onDelete: 'RESTRICT',
        },
      };
      const options = {
        sequelize,
        modelName: 'Account',
        tableName: 'accounts',
        timestamps: false,
      };
      const UserModel = sequelize.define('Account', attributes, options);
      const guard = new SequelizeGuard(sequelize, { UserModel });
      await guard.ready;
      UserModel.init(
        {
          ...attributes,
          parent_id: {
            ...attributes.parent_id,
            onDelete: change === 'foreign key' ? 'CASCADE' : 'RESTRICT',
          },
        },
        {
          ...options,
          indexes: change === 'index' ? [{ fields: ['parent_id'] }] : [],
        },
      );
      const query = vi.spyOn(sequelize, 'query');
      await expect(guard.sync({ alter: true })).rejects.toThrow(
        'model binding changed',
      );
      expect(query).not.toHaveBeenCalled();
    },
  );

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
