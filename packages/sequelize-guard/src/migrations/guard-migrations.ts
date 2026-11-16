import lodash from 'lodash';
import type {
  QueryInterface,
  QueryOptions,
  Sequelize,
  TableName,
} from 'sequelize';
import { defaultOptions } from '../constants';
import {
  AssociationModelType,
  BaseModelType,
  getTableName,
} from '../sequelize-models';
import { guardIndexes } from '../sequelize-models/guard-indexes';
import {
  assertGuardSchema,
  assertNoLegacyTableNames,
  guardTable,
  physicalTableKey,
  sequelizeOptions,
  validateGuardTables,
} from '../sequelize-models/guard-tables';
import { guardUserKey } from '../sequelize-models/user-key';
import type { GuardInternalOptions, GuardOptions } from '../types';
import { verifyMigrationTables } from './guard-migration-ownership';
import { guardColumns } from './guard-schema';
import { createMigrationTable } from './guard-table-ddl';
import { copyGuardTables, type GuardUpgradeOptions } from './guard-upgrade';

type MigrationQueries = Pick<QueryOptions, 'transaction' | 'useMaster'>;

export const migrationOrder = {
  up: [
    BaseModelType.Resources,
    BaseModelType.Permissions,
    BaseModelType.Roles,
    BaseModelType.Users,
    AssociationModelType.RolePermission,
    AssociationModelType.RoleUser,
  ],
  down: [
    AssociationModelType.RoleUser,
    AssociationModelType.RolePermission,
    BaseModelType.Roles,
    BaseModelType.Permissions,
    BaseModelType.Resources,
    BaseModelType.Users,
  ],
};

function migrationTables(
  sequelize: Sequelize,
  options: GuardInternalOptions,
  order: keyof typeof migrationOrder,
) {
  validateGuardTables(sequelize, options);
  return migrationOrder[order]
    .filter((type) => type !== BaseModelType.Users || !options.UserModel)
    .map((type) => ({ type, table: guardTable(sequelize, options, type) }));
}

async function withMigration(
  sequelize: Sequelize,
  queryInterface: QueryInterface,
  execute: (options: MigrationQueries, created: TableName[]) => Promise<void>,
): Promise<void> {
  const writer: MigrationQueries = { useMaster: true };
  if (!['mysql', 'mariadb'].includes(sequelize.getDialect())) {
    await sequelize.transaction((transaction) =>
      execute({ ...writer, transaction }, []),
    );
    return;
  }

  // MySQL commits DDL implicitly. Only clean up tables created by this run.
  const created: TableName[] = [];
  try {
    await execute(writer, created);
  } catch (error) {
    for (const table of created.reverse()) {
      try {
        await queryInterface.dropTable(table, writer);
      } catch (cleanupError) {
        throw new AggregateError(
          [error, cleanupError],
          'Guard migration failed and could not remove all newly created tables',
        );
      }
    }
    throw error;
  }
}

async function createTables(
  queryInterface: QueryInterface,
  sequelize: Sequelize,
  options: GuardInternalOptions,
  queryOptions: MigrationQueries,
  created: TableName[],
): Promise<void> {
  const tables = migrationTables(sequelize, options, 'up');
  const columns = guardColumns(sequelize, options);
  const { define } = sequelizeOptions(sequelize);
  await assertGuardSchema(sequelize, options, queryOptions);
  await assertNoLegacyTableNames(sequelize, options, queryOptions);
  for (const { type, table } of tables) {
    if (await queryInterface.tableExists(table, queryOptions)) {
      throw new Error(
        `Guard table "${getTableName(type, options)}" already exists. Use migration.upgrade for an existing installation.`,
      );
    }
  }
  if (
    options.UserModel &&
    !(await queryInterface.tableExists(
      guardUserKey(sequelize, options).table,
      queryOptions,
    ))
  ) {
    throw new Error(
      'Create the supplied UserModel table before running Guard migrations',
    );
  }

  for (const { type, table } of tables) {
    const collation =
      type === AssociationModelType.RoleUser && options.UserModel
        ? options.UserModel.options
        : define;
    await createMigrationTable(queryInterface, table, columns[type], {
      ...queryOptions,
      charset: collation?.charset,
      collate: collation?.collate,
    });
    created.push(table);
    for (const index of guardIndexes(type, getTableName(type, options))) {
      await queryInterface.addIndex(table, { ...index, ...queryOptions });
    }
  }
}

/** Create a fresh Guard schema. Application user tables must already exist. */
async function up(
  queryInterface: QueryInterface,
  _Sequelize: Sequelize | typeof Sequelize,
  options: GuardOptions = {},
): Promise<void> {
  const { sequelize } = queryInterface;
  const resolved = lodash.merge({}, defaultOptions, options);
  await withMigration(sequelize, queryInterface, (queryOptions, created) =>
    createTables(queryInterface, sequelize, resolved, queryOptions, created),
  );
}

/** Drop the owned Guard tables in reverse dependency order. */
async function down(
  queryInterface: QueryInterface,
  _Sequelize: Sequelize | typeof Sequelize,
  options: GuardOptions = {},
): Promise<void> {
  const { sequelize } = queryInterface;
  const resolved = lodash.merge({}, defaultOptions, options);
  const columns = guardColumns(sequelize, resolved);
  const tables = migrationTables(sequelize, resolved, 'down').map(
    ({ type, table }) => ({
      table,
      columns: columns[type],
      indexes: guardIndexes(type, getTableName(type, resolved)),
    }),
  );
  await withMigration(sequelize, queryInterface, async (queryOptions) => {
    await assertGuardSchema(sequelize, resolved, queryOptions);
    await assertNoLegacyTableNames(sequelize, resolved, queryOptions);
    const existing = await verifyMigrationTables(
      queryInterface,
      tables,
      queryOptions,
    );
    for (const table of existing)
      await queryInterface.dropTable(table, queryOptions);
  });
}

/**
 * Copy an offline installation to distinct tables, preserving the originals.
 * Use the actual table names of the previous installation for `from`.
 */
async function upgrade(
  queryInterface: QueryInterface,
  _Sequelize: Sequelize | typeof Sequelize,
  { from, to }: GuardUpgradeOptions,
): Promise<void> {
  const { sequelize } = queryInterface;
  if (!['sqlite', 'postgres', 'mysql'].includes(sequelize.getDialect())) {
    throw new Error('Guard upgrade supports SQLite, PostgreSQL, and MySQL');
  }
  const source = lodash.merge({}, defaultOptions, from);
  const target = lodash.merge({}, defaultOptions, to);
  const sourceTables = migrationTables(sequelize, source, 'up');
  const targetTables = migrationTables(sequelize, target, 'up');
  if (source.UserModel !== target.UserModel) {
    throw new Error(
      'Guard upgrade requires the same UserModel in both configurations',
    );
  }
  if (
    sourceTables.some(({ table: sourceTable }) =>
      targetTables.some(
        ({ table: targetTable }) =>
          physicalTableKey(sequelize, sourceTable) ===
          physicalTableKey(sequelize, targetTable),
      ),
    )
  ) {
    throw new Error(
      'Guard upgrade requires wholly distinct destination tables, usually a new prefix',
    );
  }
  await withMigration(
    sequelize,
    queryInterface,
    async (queryOptions, created) => {
      await assertGuardSchema(sequelize, source, queryOptions);
      const copy = await copyGuardTables(
        queryInterface,
        source,
        target,
        sourceTables,
        targetTables,
        queryOptions,
      );
      await createTables(
        queryInterface,
        sequelize,
        target,
        queryOptions,
        created,
      );
      await copy();
    },
  );
}

export default { up, down, upgrade };
