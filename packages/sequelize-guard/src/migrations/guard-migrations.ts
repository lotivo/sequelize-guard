import type {
  ModelAttributes,
  QueryInterface,
  QueryOptions,
  Sequelize,
  TableName,
} from 'sequelize';
import { resolveGuardOptions } from '../core/guard-options';
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
import {
  addHolderOwnership,
  assertMatchingBaseReceipt,
  assertMatchingReceipt,
  assertOwnedOrEmptySchema,
  guardOwnership,
  ownershipRow,
  readGuardOwnership,
} from './guard-ownership';
import { guardColumns } from './guard-schema';
import { createMigrationTable } from './guard-table-ddl';
import { copyGuardTables, type GuardUpgradeOptions } from './guard-upgrade';

type MigrationQueries = Pick<
  QueryOptions,
  'transaction' | 'useMaster' | 'logging' | 'benchmark'
>;

export const migrationOrder = {
  up: [
    BaseModelType.Resources,
    BaseModelType.Permissions,
    BaseModelType.Roles,
    BaseModelType.Users,
    AssociationModelType.RolePermission,
    AssociationModelType.RoleUser,
    BaseModelType.RoleHierarchy,
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
  // SQLite schemas are encoded in the physical table name. Passing a string
  // with a dot to addIndex makes Sequelize split it into SQL qualification.
  const indexTable =
    query.sequelize.getDialect() === 'sqlite' && typeof table.table === 'string'
      ? { tableName: table.table }
      : table.table;
  for (const index of table.indexes)
    await query.addIndex(indexTable, { ...index, ...options });
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
    if (type === BaseModelType.RoleHierarchy) continue;
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
  }
  await createHolderTables(queryInterface, holders, queryOptions, created);
}

async function createOwnershipReceipt(
  queryInterface: QueryInterface,
  options: GuardInternalOptions,
  queryOptions: MigrationQueries,
  created: TableName[],
): Promise<void> {
  const { sequelize } = queryInterface;
  const table = guardTable(sequelize, options, BaseModelType.RoleHierarchy);
  await createMigrationTable(
    queryInterface,
    table,
    guardColumns(sequelize, options).role_hierarchy,
    queryOptions,
  );
  created.push(table);
  await queryInterface.bulkInsert(
    table,
    [ownershipRow(sequelize, options)],
    queryOptions,
  );
}

export async function provisionGuardSchema(
  queryInterface: QueryInterface,
  options: GuardInternalOptions,
  logging: Pick<QueryOptions, 'logging' | 'benchmark'> = {},
): Promise<void> {
  const { sequelize } = queryInterface;
  await withMigration(
    sequelize,
    queryInterface,
    async (queryOptions, created) => {
      const writer = { ...logging, ...queryOptions };
      await createTables(queryInterface, sequelize, options, writer, created);
      await createOwnershipReceipt(queryInterface, options, writer, created);
    },
  );
}

/** Create a fresh Guard schema. Application user tables must already exist. */
async function up(
  queryInterface: QueryInterface,
  _Sequelize: Sequelize | typeof Sequelize,
  options: GuardOptions = {},
): Promise<void> {
  await provisionGuardSchema(queryInterface, resolveGuardOptions(options));
}

/** Drop the owned Guard tables in reverse dependency order. */
async function down(
  queryInterface: QueryInterface,
  _Sequelize: Sequelize | typeof Sequelize,
  options: GuardOptions = {},
): Promise<void> {
  const { sequelize } = queryInterface;
  const resolved = resolveGuardOptions(options);
  await withMigration(sequelize, queryInterface, async (queryOptions) => {
    await assertGuardSchema(sequelize, resolved, queryOptions);
    await assertNoLegacyTableNames(sequelize, resolved, queryOptions);
    if (!(await assertOwnedOrEmptySchema(sequelize, resolved, queryOptions)))
      return;
    const existing = await verifyOwnedGuardTables(
      queryInterface,
      resolved,
      queryOptions,
    );
    if (['mysql', 'mariadb'].includes(sequelize.getDialect())) {
      // DDL cannot roll back here. Revoke the complete receipt before the first
      // DROP so an interrupted rollback cannot claim a subsequently reused name.
      // Remaining tables require operator recovery, never automatic adoption.
      const receipt = guardTable(
        sequelize,
        resolved,
        BaseModelType.RoleHierarchy,
      );
      await queryInterface.bulkDelete(receipt, { id: 1 }, queryOptions);
    }
    for (const table of existing) {
      await queryInterface.dropTable(table, queryOptions);
    }
  });
}

export function verifyOwnedGuardTables(
  queryInterface: QueryInterface,
  options: GuardInternalOptions,
  queryOptions: QueryOptions,
) {
  const { sequelize } = queryInterface;
  const columns = guardColumns(sequelize, options);
  const tables = [
    ...holderTables(sequelize, options).map(
      ({ table, attributes, indexes }) => ({
        table,
        columns: attributes,
        indexes,
      }),
    ),
    ...migrationTables(sequelize, options, 'down').map(({ type, table }) => ({
      table,
      columns: columns[type],
      indexes: guardIndexes(type, getTableName(type, options)),
    })),
  ];
  return verifyMigrationTables(queryInterface, tables, queryOptions);
}

/**
 * Copy an offline installation to distinct tables, preserving the originals.
 * Use the actual table names of the previous installation for `from`.
 */
async function upgrade(
  queryInterface: QueryInterface,
  _Sequelize: Sequelize | typeof Sequelize,
  { from, to, inheritExistingParents = false, ...unknown }: GuardUpgradeOptions,
): Promise<void> {
  const unknownName = Object.keys(unknown)[0];
  if (unknownName)
    throw new TypeError(`Unknown guard upgrade option "${unknownName}"`);
  if (typeof inheritExistingParents !== 'boolean') {
    throw new TypeError(
      'Guard upgrade inheritExistingParents must be a boolean',
    );
  }
  const { sequelize } = queryInterface;
  if (!['sqlite', 'postgres', 'mysql'].includes(sequelize.getDialect())) {
    throw new Error('Guard upgrade supports SQLite, PostgreSQL, and MySQL');
  }
  const source = resolveGuardOptions(from);
  const target = resolveGuardOptions(to);
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
      const receipt = await readGuardOwnership(sequelize, source, queryOptions);
      if (receipt)
        assertMatchingReceipt(receipt, guardOwnership(sequelize, source));
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
        inheritExistingParents || receipt !== null,
      );
      await createTables(
        queryInterface,
        sequelize,
        target,
        queryOptions,
        created,
      );
      await copy();
      await createOwnershipReceipt(
        queryInterface,
        target,
        queryOptions,
        created,
      );
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
  const resolved = resolveGuardOptions(options);
  const holders = holderTables(sequelize, resolved);
  if (!holders.length) return;
  await withMigration(
    sequelize,
    queryInterface,
    async (queryOptions, created) => {
      await assertGuardSchema(sequelize, resolved, queryOptions);
      const receipt = await readGuardOwnership(
        sequelize,
        resolved,
        queryOptions,
      );
      if (!receipt)
        throw new Error(
          'Create or upgrade the Guard schema before adding role holders',
        );
      const expected = guardOwnership(sequelize, resolved);
      assertMatchingBaseReceipt(receipt, expected);
      const priorTypes = new Set(receipt.holders.map(([type]) => type));
      for (const [type] of expected.holders) {
        if (priorTypes.has(type))
          throw new Error(`Guard role holder "${type}" already exists`);
      }
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
      await addHolderOwnership(sequelize, resolved, receipt, queryOptions);
    },
  );
}

export default { up, down, upgrade, addRoleHolders };
