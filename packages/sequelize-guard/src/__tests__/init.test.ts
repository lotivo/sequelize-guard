import { Sequelize } from 'sequelize';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import migration, { migrationOrder } from '../migrations/guard-migrations';
import { schemas } from '../migrations/guard-schema';
import { getTableName, GuardUserModel } from '../sequelize-models';
import { SequelizeGuard } from '../SequelizeGuard';
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
      const { stub, migration: migrationArr } = createQueryInterfaceStub();
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
      const { stub, migration: migrationArr } = createQueryInterfaceStub();
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

    it('should run down migrations', async () => {
      // setup
      const { stub, migration: migrationArr } = createQueryInterfaceStub();
      const expected = migrationOrder.down.map((m) =>
        getTableName(m, { prefix: 'guard_' }),
      );
      // execute
      await migration.down(stub, context.guard.sequelize);
      // assert
      expect(migrationArr).toEqual(expected);
    });

    it('should run down migrations with options', async () => {
      // setup
      const { stub, migration: migrationArr } = createQueryInterfaceStub();
      const expected = migrationOrder.down.map((m) =>
        getTableName(m, { prefix: 'guard_' }),
      );
      // execute
      await migration.down(stub, context.guard.sequelize, {
        prefix: 'guard_',
      });
      // assert
      expect(migrationArr).toEqual(expected);
    });
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
