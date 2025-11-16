import { QueryInterface, Sequelize } from 'sequelize';
import { SequelizeGuard } from '../index';
import { SequelizeWithGuard } from '../types/helpers';
import { seedTestData } from './utils/test-utils';
import { generateDbPath, cleanupDbFile } from './utils/db-utils';

export interface TestContext {
  sequelize: SequelizeWithGuard;
  guard: SequelizeGuard;
  dbPath?: string;
}

/**
 * Create an isolated test database with proper initialization
 * Each test suite should get its own instance to prevent data conflicts
 */
export async function createTestDatabase(options?: {
  seedData?: boolean;
}): Promise<TestContext> {
  const { seedData = false } = options || {};

  // Create unique database file for isolation
  // Using a unique database file ensures complete isolation between test suites
  const dbPath = generateDbPath('test_setup');

  const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: dbPath,
    logging: false,
  });

  // Authenticate connection
  await sequelize.authenticate();

  // Initialize SequelizeGuard with sync enabled
  const guard = new SequelizeGuard(sequelize, {
    sync: true,
    debug: false,
    timestamps: true,
    paranoid: false,
  });

  // Wait for initialization to complete (models synced, cache loaded)
  await guard.ready;

  // Seed test data if requested
  if (seedData) {
    await seedTestData(guard, guard.sequelize);
  }

  return { sequelize: guard.sequelize, guard, dbPath };
}

export async function closeTestDatabase(context: TestContext): Promise<void> {
  if (context.sequelize) {
    await context.sequelize.close();
  }

  // Clean up database file after closing connection
  if (context.dbPath) {
    cleanupDbFile(context.dbPath);
  }
}

export function createQueryInterfaceStub() {
  const migration: string[] = [];
  const seeds: string[] = [];

  const queryInterfaceStub = {
    createTable: function (tableName: string) {
      migration.push(tableName);
    },
    dropTable: function (tableName: string) {
      migration.push(tableName);
    },
    bulkInsert: function (tableName: string) {
      seeds.push(tableName);
    },
    bulkDelete: function (tableName: string) {
      seeds.push(tableName);
    },
  } as unknown as QueryInterface;

  return {
    stub: queryInterfaceStub,
    migration,
    seeds,
  };
}
