import { DataTypes, Model, Sequelize } from 'sequelize';
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  beforeEach,
  onTestFinished,
  vi,
} from 'vitest';
import { SequelizeGuard, type GuardOptions } from '../index';
import migration, { migrationOrder } from '../migrations/guard-migrations';
import { schemas } from '../migrations/guard-schema';
import { getTableName, GuardUserModel } from '../sequelize-models';
import {
  createTestDatabase,
  closeTestDatabase,
  createQueryInterfaceStub,
  TestContext,
} from './setup';
import { generateDbPath, cleanupDbFile } from './utils/db-utils';

describe('SequelizeGuard Initialization', () => {
  let seqMem1: Sequelize;
  let seqMem2: Sequelize;
  let dbPath1: string;
  let dbPath2: string;

  beforeAll(() => {
    dbPath1 = generateDbPath('test_init_1');
    dbPath2 = generateDbPath('test_init_2');

    seqMem1 = new Sequelize({
      dialect: 'sqlite',
      storage: dbPath1,
      logging: false,
    });
    seqMem2 = new Sequelize({
      dialect: 'sqlite',
      storage: dbPath2,
      logging: false,
    });
  });

  afterAll(async () => {
    await seqMem1?.close();
    await seqMem2?.close();
    cleanupDbFile(dbPath1);
    cleanupDbFile(dbPath2);
  });

  describe('Custom config initialization', () => {
    it('should be initialized when user model passed', async () => {
      // setup
      const GuardUser = seqMem1.define<GuardUserModel>(
        'User',
        schemas['users'],
        {
          tableName: 'guard_users',
        },
      );
      // execute
      const seqGuard = new SequelizeGuard(seqMem1, {
        sync: true,
        debug: false,
        timestamps: true,
        paranoid: true,
        UserModel: GuardUser,
      });
      await seqGuard.ready;
      // assert
      expect(seqGuard).toBeDefined();
    });

    it('should be initialized with various options', async () => {
      // setup
      // execute
      const seqGuard = new SequelizeGuard(seqMem2, {
        sync: true,
        debug: false,
        timestamps: true,
        paranoid: false,
      });
      // Wait for sync to complete before test ends
      await seqGuard.ready;
      // assert
      expect(seqGuard).toBeDefined();
    });
  });
});

describe('SequelizeGuard Setup', () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await createTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase(context);
  });

  describe('Migrations', () => {
    it('should run up migration', async () => {
      // setup
      const { stub, migration: migrationArr } = createQueryInterfaceStub(
        context.sequelize,
      );
      const expected = migrationOrder.up.map((m) =>
        getTableName(m, { prefix: 'guard_' }),
      );
      // execute
      await migration.up(stub, context.guard.sequelize);
      // assert
      expect(migrationArr).toEqual(expected);
    });

    it('should run up migration with options', async () => {
      // setup
      const { stub, migration: migrationArr } = createQueryInterfaceStub(
        context.sequelize,
      );
      const expected = migrationOrder.up.map((m) =>
        getTableName(m, { prefix: 'guard_' }),
      );
      // execute
      await migration.up(stub, context.guard.sequelize, {
        prefix: 'guard_',
        timestamps: true,
        paranoid: true,
      });
      // assert
      expect(migrationArr).toEqual(expected);
    });

    it.each([
      undefined,
      { prefix: 'checked_', timestamps: true, paranoid: true },
    ])(
      'runs down migrations in dependency order with options %j',
      async (options) => {
        const sequelize = new Sequelize({
          dialect: 'sqlite',
          storage: ':memory:',
          logging: false,
        });
        onTestFinished(() => sequelize.close());
        const queryInterface = sequelize.getQueryInterface();
        await migration.up(queryInterface, sequelize, options);
        const dropTable = vi.spyOn(queryInterface, 'dropTable');
        await migration.down(queryInterface, sequelize, options);
        expect(dropTable.mock.calls.map(([table]) => table)).toEqual(
          migrationOrder.down.map((type) =>
            getTableName(type, { prefix: options?.prefix ?? 'guard_' }),
          ),
        );
      },
    );
  });

  // describe('Seeders', () => {
  //   it.skip('should run up seeder (seeder not yet implemented)', async () => {
  //     // TODO: Implement seeder tests once seeder is implemented
  //     expect(seeder).toBeDefined();
  //   });
  // });

  describe('Models', () => {
    it('should return all guard models (6 models)', () => {
      // setup
      // execute
      const models = Object.keys(context.guard.models());
      // assert
      expect(models.length).toBe(6);
    });
  });
});

describe('Guard ownership and options', () => {
  let sequelize: Sequelize;

  beforeEach(() => {
    sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
    });
  });

  afterEach(async () => {
    await sequelize.close();
  });

  it.each<GuardOptions>([
    { sync: 'false' as unknown as boolean },
    { debug: 1 as unknown as boolean },
    { timestamps: null as unknown as boolean },
    { paranoid: 1 as unknown as boolean },
    { safeGuardDeletes: 'false' as unknown as boolean },
    { userCache: 'true' as unknown as boolean },
    { userCacheTtl: -1 },
    { userCacheTtl: Infinity },
    { primaryKey: 'uuid' },
    { userPk: '' },
    { prefix: 17 as unknown as string },
    { tables: { roles: '' } },
    { tables: { roles: null as unknown as string } },
    { UserModel: {} as GuardOptions['UserModel'] },
    { typo: true } as GuardOptions,
  ])(
    'rejects invalid configuration before registering models (%j)',
    (options) => {
      expect(
        () => new SequelizeGuard(sequelize, { sync: false, ...options }),
      ).toThrow(TypeError);
      expect(sequelize.models).toEqual({});
      expect(sequelize).not.toHaveProperty('guard');
    },
  );

  it('rejects another guard without replacing the original owner', async () => {
    const guard = new SequelizeGuard(sequelize);
    await guard.ready;
    const cache = await guard.getCache();
    expect(
      () => new SequelizeGuard(sequelize, { prefix: 'other_', sync: false }),
    ).toThrow('already has a guard');
    expect(guard.sequelize.guard).toBe(guard);
    expect(guard.sequelize.models.GuardModels).toBe(guard.models());
    expect(await guard.getCache()).toBe(cache);
  });

  it('preserves a separately registered application User', async () => {
    const User = sequelize.define('User', {});
    const Account = sequelize.define('Account', {});
    expect(() => new SequelizeGuard(sequelize, { sync: false })).toThrow(
      'User',
    );
    expect(sequelize.models).toEqual({ User, Account });

    const guard = new SequelizeGuard(sequelize, { UserModel: Account });
    await guard.ready;
    expect(sequelize.models.User).toBe(User);
    const account = await guard.makeUser();
    await account.assignRole!('account-reader');
    expect(await account.isA!('account-reader')).toBe(true);
  });

  it('rejects guard-owned model names and tables before registering other models', () => {
    const GuardRole = sequelize.define('GuardRole', {});
    expect(() => new SequelizeGuard(sequelize, { sync: false })).toThrow(
      'GuardRole',
    );
    expect(sequelize.models).toEqual({ GuardRole });
  });

  it.each(['can', 'getRoles', 'Roles'])(
    'preserves a colliding member named %s',
    (member) => {
      class Account extends Model {}
      const original = () => 'application member';
      Object.defineProperty(Account.prototype, member, { value: original });
      Account.init({}, { sequelize });

      expect(
        () =>
          new SequelizeGuard(sequelize, { sync: false, UserModel: Account }),
      ).toThrow(member);
      expect(sequelize.models).toEqual({ Account });
      expect(Account.associations).toEqual({});
      expect(
        Object.getOwnPropertyDescriptor(Account.prototype, member)?.value,
      ).toBe(original);
    },
  );

  it('rejects a supplied user model with a conflicting Roles association', () => {
    const Account = sequelize.define('Account', {});
    const Group = sequelize.define('Group', {});
    const association = Account.belongsTo(Group, { as: 'Roles' });
    expect(
      () => new SequelizeGuard(sequelize, { sync: false, UserModel: Account }),
    ).toThrow('Roles');
    expect(sequelize.models).toEqual({ Account, Group });
    expect(Account.associations.Roles).toBe(association);
  });

  it('applies explicit names, defaults and debug logging to model sync', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      const guard = new SequelizeGuard(sequelize, {
        prefix: '',
        tables: { users: 'members', roles: 'policy_roles' },
        primaryKey: 'id',
        userPk: 'id',
        timestamps: true,
        paranoid: true,
        debug: true,
      });
      await guard.ready;
      const { GuardUser, GuardRole } = guard.models();
      expect(GuardUser.getTableName()).toBe('members');
      expect(GuardRole.getTableName()).toBe('policy_roles');
      expect(GuardRole.primaryKeyAttribute).toBe('id');
      expect(GuardRole.getAttributes()).toHaveProperty('createdAt');
      expect(GuardRole.getAttributes()).toHaveProperty('deletedAt');
      expect(log).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE'));
      const user = await GuardUser.create();
      await user.destroy();
      expect(await GuardUser.findByPk(user.id)).toBeNull();
      expect(
        await GuardUser.findByPk(user.id, { paranoid: false }),
      ).not.toBeNull();
    } finally {
      log.mockRestore();
    }
  });

  it('rejects an unrelated application model using a guard-owned table', () => {
    const Application = sequelize.define(
      'Application',
      {
        name: DataTypes.STRING,
      },
      { tableName: 'guard_roles' },
    );
    expect(() => new SequelizeGuard(sequelize, { sync: false })).toThrow(
      'guard_roles',
    );
    expect(sequelize.models).toEqual({ Application });
  });
});

describe('Guard-owned resources', () => {
  it('keeps one manual cache sweeper and stable listener counts across resets', async () => {
    const sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
    });
    try {
      const guard = new SequelizeGuard(sequelize, {
        sync: false,
        userCache: false,
        userCacheTtl: 2,
      });
      await guard.ready;
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
      try {
        const baseline = vi.getTimerCount();
        const cache = guard.resetCache();
        expect(vi.getTimerCount()).toBe(baseline);
        const listeners = guard._ee
          .eventNames()
          .map((event) => guard._ee.listenerCount(event));
        const userCache = guard.getUserCache();
        try {
          for (let iteration = 0; iteration < 20; iteration++) {
            expect(guard.resetCache()).toBe(cache);
            expect(guard.resetUserCache()).toBe(userCache);
          }
          expect(vi.getTimerCount()).toBe(baseline + 1);
          expect(
            guard._ee
              .eventNames()
              .map((event) => guard._ee.listenerCount(event)),
          ).toEqual(listeners);

          const expired = vi.fn();
          userCache.on('expired', expired);
          userCache.set('user', ['reader']);
          expect(userCache.get('user')).toEqual(['reader']);
          vi.advanceTimersByTime(601_000);
          expect(expired).toHaveBeenCalledWith('user', ['reader']);
          expect(userCache.keys()).toEqual([]);
        } finally {
          userCache.close();
        }
        expect(vi.getTimerCount()).toBe(baseline);
      } finally {
        vi.useRealTimers();
      }
      await expect(sequelize.authenticate()).resolves.toBeUndefined();
    } finally {
      await sequelize.close();
    }
  });
});
