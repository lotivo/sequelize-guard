import lodash from 'lodash';
import type {
  ModelAttributes,
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
  assertCompleteRoleHolderConfiguration,
  assertRoleHolderTables,
  roleHolderTables,
} from '../sequelize-models/guard-role-holders';
import {
  assertCurrentGuardSchema,
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
    BaseModelType.RoleHierarchy,
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
    BaseModelType.RoleHierarchy,
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

function resolveOptions(options: GuardOptions): GuardInternalOptions {
  return {
    ...lodash.merge({}, defaultOptions, options),
    roleHolders: { ...options.roleHolders },
  };
}

function holderTables(sequelize: Sequelize, options: GuardInternalOptions) {
  const columns = guardColumns(sequelize, options).role_user;
  return roleHolderTables(sequelize, options).map(
    ({ attributes, ...registration }) => ({
      ...registration,
      attributes: { ...columns, ...attributes },
      type: AssociationModelType.RoleUser as const,
      holderType: registration.type,
    }),
  );
}

async function createIndexedTable(
  query: QueryInterface,
  table: {
    table: TableName;
    attributes: ModelAttributes;
    indexes: ReturnType<typeof guardIndexes>;
    charset?: string;
    collate?: string;
  },
  options: MigrationQueries,
  created: TableName[],
) {
  await createMigrationTable(query, table.table, table.attributes, {
    ...options,
    charset: table.charset,
    collate: table.collate,
  });
  created.push(table.table);
  for (const index of table.indexes)
    await query.addIndex(table.table, { ...index, ...options });
}

async function assertCreatableHolderTables(
  query: QueryInterface,
  holders: ReturnType<typeof holderTables>,
  options: MigrationQueries,
) {
  for (const { table, tableName } of holders) {
    if (await query.tableExists(table, options)) {
      throw new Error(`Guard role holder table "${tableName}" already exists`);
    }
  }
  await assertRoleHolderTables(
    query.sequelize,
    holders.map(({ model }) => model),
    options,
  );
}

async function createHolderTables(
  query: QueryInterface,
  holders: ReturnType<typeof holderTables>,
  options: MigrationQueries,
  created: TableName[],
) {
  for (const { model, ...table } of holders) {
    await createIndexedTable(
      query,
      {
        ...table,
        charset: model.options.charset,
        collate: model.options.collate,
      },
      options,
      created,
    );
  }
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
  const holders = holderTables(sequelize, options);
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
  await assertCreatableHolderTables(queryInterface, holders, queryOptions);

  for (const { type, table } of tables) {
    const collation =
      type === AssociationModelType.RoleUser && options.UserModel
        ? options.UserModel.options
        : define;
    await createIndexedTable(
      queryInterface,
      {
        table,
        attributes: columns[type],
        charset: collation?.charset,
        collate: collation?.collate,
        indexes: guardIndexes(type, getTableName(type, options)),
      },
      queryOptions,
      created,
    );
    if (type === BaseModelType.RoleHierarchy) {
      await queryInterface.bulkInsert(
        table,
        [{ id: 1, revision: 0 }],
        queryOptions,
      );
    }
  }
  await createHolderTables(queryInterface, holders, queryOptions, created);
}

/** Create a fresh Guard schema. Application user tables must already exist. */
async function up(
  queryInterface: QueryInterface,
  _Sequelize: Sequelize | typeof Sequelize,
  options: GuardOptions = {},
): Promise<void> {
  const { sequelize } = queryInterface;
  const resolved = resolveOptions(options);
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
  const resolved = resolveOptions(options);
  const columns = guardColumns(sequelize, resolved);
  const tables = [
    ...holderTables(sequelize, resolved).map(
      ({ table, attributes, indexes }) => ({
        table,
        columns: attributes,
        indexes,
      }),
    ),
    ...migrationTables(sequelize, resolved, 'down').map(({ type, table }) => ({
      table,
      columns: columns[type],
      indexes: guardIndexes(type, getTableName(type, resolved)),
    })),
  ];
  await withMigration(sequelize, queryInterface, async (queryOptions) => {
    await assertGuardSchema(sequelize, resolved, queryOptions);
    await assertNoLegacyTableNames(sequelize, resolved, queryOptions);
    await assertCompleteRoleHolderConfiguration(
      sequelize,
      resolved,
      queryOptions,
    );
    const existing = await verifyMigrationTables(
      queryInterface,
      tables,
      queryOptions,
    );
    for (const table of existing) {
      await queryInterface.dropTable(table, queryOptions);
    }
  });
}

/**
 * Copy an offline installation to distinct tables, preserving the originals.
 * Use the actual table names of the previous installation for `from`.
 */
async function upgrade(
  queryInterface: QueryInterface,
  _Sequelize: Sequelize | typeof Sequelize,
  { from, to, inheritExistingParents = false }: GuardUpgradeOptions,
): Promise<void> {
  const { sequelize } = queryInterface;
  if (!['sqlite', 'postgres', 'mysql'].includes(sequelize.getDialect())) {
    throw new Error('Guard upgrade supports SQLite, PostgreSQL, and MySQL');
  }
  const source = resolveOptions(from);
  const target = resolveOptions(to);
  const sourceHolders = holderTables(sequelize, source);
  const targetHolders = holderTables(sequelize, target);
  const preservedHolders = sourceHolders.map(({ holderType, model }) => {
    const holder = targetHolders.find(
      (holder) => holder.holderType === holderType && holder.model === model,
    );
    if (!holder)
      throw new Error(
        `Guard upgrade requires the same model for role holder "${holderType}"`,
      );
    return holder;
  });
  const sourceTables = [
    ...migrationTables(sequelize, source, 'up'),
    ...sourceHolders,
  ];
  const targetTables = [
    ...migrationTables(sequelize, target, 'up'),
    ...targetHolders,
  ];
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
      await assertCompleteRoleHolderConfiguration(
        sequelize,
        source,
        queryOptions,
      );
      const copy = await copyGuardTables(
        queryInterface,
        source,
        target,
        sourceTables.filter(({ type }) => type !== BaseModelType.RoleHierarchy),
        [
          ...migrationTables(sequelize, target, 'up').filter(
            ({ type }) => type !== BaseModelType.RoleHierarchy,
          ),
          ...preservedHolders,
        ],
        queryOptions,
        inheritExistingParents,
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

/** Provision only newly registered holder junctions for a current Guard schema. */
async function addRoleHolders(
  queryInterface: QueryInterface,
  _Sequelize: Sequelize | typeof Sequelize,
  options: GuardOptions,
): Promise<void> {
  const { sequelize } = queryInterface;
  const resolved = resolveOptions(options);
  const holders = holderTables(sequelize, resolved);
  if (!holders.length) return;
  await withMigration(
    sequelize,
    queryInterface,
    async (queryOptions, created) => {
      await assertGuardSchema(sequelize, resolved, queryOptions);
      await assertCurrentGuardSchema(sequelize, resolved, queryOptions);
      if (
        !(await queryInterface.tableExists(
          guardTable(sequelize, resolved, BaseModelType.Roles),
          queryOptions,
        ))
      ) {
        throw new Error(
          'Create or upgrade the Guard schema before adding role holders',
        );
      }
      await assertCreatableHolderTables(queryInterface, holders, queryOptions);
      await createHolderTables(queryInterface, holders, queryOptions, created);
    },
  );
}

export default { up, down, upgrade, addRoleHolders };
