import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Sequelize } from 'sequelize';
import { GuardUserModel, SequelizeGuard } from '../index';
import { schemas, tablesMap } from '../migrations/guard-schema';
import migration from '../migrations/guard-migrations';
import seeder from '../seeder';
import {
  createTestDatabase,
  closeTestDatabase,
  createQueryInterfaceStub,
  TestContext,
} from './setup';

describe('SequelizeGuard Initialization', () => {
  let seqMem1: Sequelize;
  let seqMem2: Sequelize;

  beforeAll(async () => {
    seqMem1 = new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
    });
    seqMem2 = new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
    });
  });

  afterAll(async () => {
    await seqMem1?.close();
    await seqMem2?.close();
  });

  describe('Custom config initialization', () => {
    it('should be initialized when user model passed', async () => {
      const GuardUser = seqMem1.define<GuardUserModel>(
        'User',
        schemas['users'],
        {
          tableName: 'guard_users',
        },
      );
      const seqGuard = new SequelizeGuard(seqMem1, {
        sync: false,
        debug: false,
        timestamps: true,
        paranoid: true,
        UserModel: GuardUser,
      });

      expect(seqGuard).toBeDefined();
    });

    it('should be initialized with various options', async () => {
      const seqGuard = new SequelizeGuard(seqMem2, {
        sync: true,
        debug: true,
        timestamps: true,
        paranoid: false,
      });

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
      const { stub, migration: migrationArr } = createQueryInterfaceStub();
      const tables = Object.values(tablesMap);
      const expected = tables.map((t: string) => 'guard_' + t);

      await migration.up(stub as any, context.guard.sequelize);

      expect(migrationArr).toEqual(expected);
    });

    it('should run up migration with options', async () => {
      const { stub, migration: migrationArr } = createQueryInterfaceStub();
      const tables = Object.values(tablesMap);
      const expected = tables.map((t: string) => 'guard_' + t);

      await migration.up(stub as any, context.guard.sequelize, {
        prefix: 'guard_',
        timestamps: true,
        paranoid: true,
      });

      expect(migrationArr).toEqual(expected);
    });

    it('should run down migrations', async () => {
      const { stub, migration: migrationArr } = createQueryInterfaceStub();
      const tables = Object.values(tablesMap);
      const expected = tables.map((t: string) => 'guard_' + t);

      await migration.down(stub as any, context.guard.sequelize);
      expect(migrationArr).toEqual(expected);
    });

    it('should run down migrations with options', async () => {
      const { stub, migration: migrationArr } = createQueryInterfaceStub();
      const tables = Object.values(tablesMap);
      const expected = tables.map((t: string) => 'guard_' + t);

      await migration.down(stub as any, context.guard.sequelize, {
        prefix: 'guard_',
      });
      expect(migrationArr).toEqual(expected);
    });
  });

  describe('Seeders', () => {
    it.skip('should run up seeder (seeder not yet implemented)', async () => {
      // TODO: Implement seeder tests once seeder is implemented
      expect(seeder).toBeDefined();
    });
  });

  describe('Models', () => {
    it('should return all guard models (6 models)', () => {
      expect(Object.keys(context.guard.models()).length).toBe(6);
    });
  });
});
