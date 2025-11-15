import { Sequelize } from 'sequelize';
import { SequelizeGuard } from '../index';

export interface TestContext {
  sequelize: Sequelize;
  guard: SequelizeGuard;
}

export async function createTestDatabase(): Promise<TestContext> {
  const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: ':memory:',
    logging: false,
  });

  await sequelize.authenticate();
  const guard = new SequelizeGuard(sequelize, {
    sync: true,
    debug: false,
  });

  // Wait for initialization
  await new Promise((resolve) => setTimeout(resolve, 200));

  return { sequelize, guard };
}

export async function closeTestDatabase(context: TestContext): Promise<void> {
  if (context.sequelize) {
    await context.sequelize.close();
  }
}

export function createQueryInterfaceStub() {
  const migration: string[] = [];
  const seeds: string[] = [];

  return {
    stub: {
      createTable: function (tableName: string) {
        migration.push(tableName);
      },
      dropTable: function (tableName: string) {
        migration.push(tableName);
      },
      bulkInsert: async function (tableName: string) {
        seeds.push(tableName);
      },
      bulkDelete: async function (tableName: string) {
        seeds.push(tableName);
      },
    },
    migration,
    seeds,
  };
}
