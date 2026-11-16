import type {
  DataType,
  ModelAttributeColumnOptions,
  ModelAttributes,
  QueryInterface,
  QueryInterfaceCreateTableOptions,
  Sequelize,
  TableName,
} from 'sequelize';

type DdlGenerators = {
  attributesToSQL(
    columns: Record<string, ModelAttributeColumnOptions>,
    options: { table: TableName; context: 'createTable' },
  ): Record<string, string>;
  createTableQuery(
    table: TableName,
    columns: Record<string, string>,
    options: QueryInterfaceCreateTableOptions,
  ): string;
};

// Sequelize 6 uses these same dialect conversions inside QueryInterface.createTable.
export function normalizeMigrationColumn(
  sequelize: Sequelize,
  column: DataType | ModelAttributeColumnOptions,
): ModelAttributeColumnOptions {
  const normalizer = sequelize as Sequelize & {
    normalizeAttribute(
      column: DataType | ModelAttributeColumnOptions,
    ): ModelAttributeColumnOptions;
  };
  return normalizer.normalizeAttribute(
    typeof column === 'object' && column !== null && 'type' in column
      ? { ...column }
      : column,
  );
}

export async function createMigrationTable(
  queryInterface: QueryInterface,
  table: TableName,
  columns: ModelAttributes,
  options: QueryInterfaceCreateTableOptions,
): Promise<void> {
  const { sequelize } = queryInterface;
  if (!['mysql', 'mariadb'].includes(sequelize.getDialect())) {
    await queryInterface.createTable(table, columns, options);
    return;
  }

  const generator = queryInterface.queryGenerator as DdlGenerators;
  const attributes = Object.fromEntries(
    Object.entries(columns).map(([name, column]) => [
      name,
      normalizeMigrationColumn(sequelize, column),
    ]),
  );
  const definitions = generator.attributesToSQL(attributes, {
    table,
    context: 'createTable',
  });
  const statement = generator.createTableQuery(table, definitions, options);
  const conditional = 'CREATE TABLE IF NOT EXISTS ';
  if (!statement.startsWith(conditional)) {
    throw new Error(
      'Cannot make the Sequelize MySQL CREATE TABLE statement exclusive',
    );
  }
  // Cleanup may only record a creation that the server actually performed.
  await sequelize.query(
    'CREATE TABLE ' + statement.slice(conditional.length),
    options,
  );
}
