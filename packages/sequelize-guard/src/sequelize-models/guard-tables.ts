import {
  QueryTypes,
  type ModelOptions,
  type Options,
  type QueryOptions,
  type QueryInterface,
  type Sequelize,
  type TableName,
} from 'sequelize';
import type { GuardInternalOptions } from '../types';
import {
  BaseModelType,
  getTableName,
  tablesMap,
  type ModelType,
} from './types/ModelType';

type SequelizeOptions = Options & {
  define?: ModelOptions & { schemaDelimiter?: string };
};

export function sequelizeOptions(sequelize: Sequelize): SequelizeOptions {
  // Sequelize 6 exposes its model defaults at runtime but omits them from its types.
  return (sequelize as Sequelize & { readonly options: SequelizeOptions })
    .options;
}

export function guardTable(
  sequelize: Sequelize,
  options: GuardInternalOptions,
  modelType: ModelType,
): TableName {
  return scopedGuardTable(sequelize, getTableName(modelType, options));
}

export function scopedGuardTable(
  sequelize: Sequelize,
  tableName: string,
): TableName {
  const { define, schema: defaultSchema } = sequelizeOptions(sequelize);
  const schema = define?.schema === undefined ? defaultSchema : define.schema;
  if (!schema) return tableName;
  const delimiter = define?.schemaDelimiter || '.';
  return sequelize.getDialect() === 'postgres'
    ? { tableName, schema, delimiter }
    : schema + delimiter + tableName;
}

function ownedTypes(options: GuardInternalOptions): ModelType[] {
  const types = Object.keys(tablesMap) as ModelType[];
  return types.filter(
    (type) => type !== BaseModelType.Users || !options.UserModel,
  );
}

export function physicalTableKey(
  sequelize: Sequelize,
  table: TableName,
): string {
  const tableName = typeof table === 'string' ? table : table.tableName;
  const schema = typeof table === 'string' ? undefined : table.schema;
  if (sequelize.getDialect() === 'postgres')
    return JSON.stringify([schema || 'public', tableName]);
  if (typeof table === 'string' || !table.schema)
    return tableName.toLowerCase();
  return [table.schema, tableName].join(table.delimiter || '.').toLowerCase();
}

export function quoteGuardTable(
  query: QueryInterface,
  table: TableName,
): string {
  const quote = (name: string) => query.quoteIdentifier(name, true);
  if (typeof table === 'string') return quote(table);
  if (!table.schema) return quote(table.tableName);
  return query.sequelize.getDialect() === 'postgres'
    ? [table.schema, table.tableName].map(quote).join('.')
    : quote([table.schema, table.tableName].join(table.delimiter || '.'));
}

export async function hasRoleHierarchy(
  sequelize: Sequelize,
  options: GuardInternalOptions,
  queryOptions: QueryOptions = {},
): Promise<boolean> {
  const query = sequelize.getQueryInterface();
  const table = guardTable(sequelize, options, BaseModelType.RoleHierarchy);
  const writer = { ...queryOptions, useMaster: true };
  if (!(await query.tableExists(table, writer))) return false;
  const marker = await sequelize.query(
    `SELECT id FROM ${quoteGuardTable(query, table)} WHERE id = 1 AND revision IN (0, 1)`,
    { ...writer, type: QueryTypes.SELECT },
  );
  return marker.length === 1;
}

export async function assertCurrentGuardSchema(
  sequelize: Sequelize,
  options: GuardInternalOptions,
  queryOptions: QueryOptions = {},
): Promise<void> {
  const roles = guardTable(sequelize, options, BaseModelType.Roles);
  const query = sequelize.getQueryInterface();
  if (
    (await query.tableExists(roles, { ...queryOptions, useMaster: true })) &&
    !(await hasRoleHierarchy(sequelize, options, queryOptions))
  ) {
    throw new Error(
      'Existing guard schema requires migration.upgrade before enabling role inheritance',
    );
  }
}

export function validateGuardTables(
  sequelize: Sequelize,
  options: GuardInternalOptions,
  extraOwned: TableName[] = [],
  extraApplication: TableName[] = [],
): void {
  const types = ownedTypes(options);
  const owned = types.map((type) => guardTable(sequelize, options, type));
  const legacy = { ...options, tables: {} };
  for (const [index, table] of owned.entries()) {
    if (
      types.some(
        (type) =>
          type !== types[index] &&
          physicalTableKey(sequelize, guardTable(sequelize, legacy, type)) ===
            physicalTableKey(sequelize, table),
      )
    ) {
      throw new Error(
        'Guard table names may not reuse the legacy name of another guard table',
      );
    }
  }
  const application = options.UserModel?.getTableName();
  const tables = [...owned, ...extraOwned, ...extraApplication];
  if (application) tables.push(application);
  if (
    new Set(tables.map((table) => physicalTableKey(sequelize, table))).size !==
    tables.length
  ) {
    throw new Error(
      'Guard and registered application tables must have distinct names',
    );
  }
  const dialect = sequelize.getDialect();
  const maxBytes =
    dialect === 'postgres'
      ? 63
      : ['mysql', 'mariadb'].includes(dialect)
        ? 64
        : Infinity;
  const exactNames =
    dialect !== 'postgres' ||
    sequelizeOptions(sequelize).quoteIdentifiers !== false;
  const quote = dialect === 'postgres' ? '"' : '`';
  for (const table of [...owned, ...extraOwned]) {
    const name = typeof table === 'string' ? table : table.tableName;
    if (
      !name.trim() ||
      name.includes('\0') ||
      name.includes(quote) ||
      (!exactNames && !/^[a-z_][a-z0-9_]*$/.test(name)) ||
      Buffer.byteLength(name) > maxBytes
    ) {
      throw new Error(`Invalid guard table name "${name}"`);
    }
  }
}

export async function assertNoLegacyTableNames(
  sequelize: Sequelize,
  options: GuardInternalOptions,
  queryOptions: QueryOptions = {},
): Promise<void> {
  const legacyOptions = { ...options, tables: {} };
  for (const type of ownedTypes(options)) {
    const legacy = guardTable(sequelize, legacyOptions, type);
    const configured = guardTable(sequelize, options, type);
    if (
      physicalTableKey(sequelize, legacy) ===
      physicalTableKey(sequelize, configured)
    )
      continue;
    if (
      await sequelize
        .getQueryInterface()
        .tableExists(legacy, { ...queryOptions, useMaster: true })
    ) {
      throw new Error(
        `Legacy guard table "${getTableName(type, legacyOptions)}" exists. Keep its original table suffix or use migration.upgrade with a new prefix before enabling custom table names.`,
      );
    }
  }
}

export async function assertGuardSchema(
  sequelize: Sequelize,
  options: GuardInternalOptions,
  queryOptions: QueryOptions = {},
): Promise<void> {
  if (sequelize.getDialect() !== 'postgres') return;
  const owned = guardTable(sequelize, options, BaseModelType.Roles);
  const application = options.UserModel?.getTableName();
  const unboundHolder = Object.values(options.roleHolders).some(
    (model) => typeof model.getTableName() === 'string',
  );
  if (
    typeof owned !== 'string' &&
    typeof application !== 'string' &&
    !unboundHolder
  )
    return;
  const [result] = await sequelize.query<{ schemas: string[] }>(
    'SELECT current_schemas(false)::text[] AS schemas',
    {
      ...queryOptions,
      type: QueryTypes.SELECT,
      useMaster: true,
    },
  );
  if (result?.schemas.join(',') !== 'public') {
    throw new Error(
      'Bind the guard and user model schemas explicitly when the PostgreSQL search path extends beyond public',
    );
  }
}
