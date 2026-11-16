import {
  QueryTypes,
  type ModelAttributes,
  type QueryInterface,
  type QueryOptions,
  type TableName,
} from 'sequelize';
import { storageTableKey } from '../sequelize-models/guard-tables';
import { normalizeMigrationColumn } from './guard-table-ddl';
import {
  findExternalMySqlReference,
  migrationForeignKeys,
  migrationIndexes,
} from './guard-table-metadata';

interface GuardTableDefinition {
  table: TableName;
  columns: ModelAttributes;
  indexes: { name?: string; unique?: boolean; fields: string[] }[];
}

function storageType(type: string): string {
  return type
    .toUpperCase()
    .replace(/^INTEGER\b/, 'INT')
    .replace(/^CHARACTER VARYING\b/, 'VARCHAR')
    .replace(/^CHARACTER\b/, 'CHAR')
    .replace(/^(TINYINT|SMALLINT|MEDIUMINT|INT|BIGINT)\(\d+\)/, '$1')
    .replace(/ BINARY$/, '');
}

async function hasGuardSchema(
  queryInterface: QueryInterface,
  { table, columns, indexes }: GuardTableDefinition,
  options: QueryOptions,
): Promise<boolean> {
  const { sequelize } = queryInterface;
  const dialect = sequelize.getDialect();
  const actual = await queryInterface.describeTable(table, options);
  const expected = Object.entries(columns).map(
    ([name, column]) =>
      [name, normalizeMigrationColumn(sequelize, column)] as const,
  );
  if (Object.keys(actual).length !== expected.length) return false;
  if (
    expected.some(([name, attribute]) => {
      const column = actual[name];
      return (
        !column ||
        column.primaryKey !== Boolean(attribute.primaryKey) ||
        (column.allowNull !== (attribute.allowNull !== false) &&
          !(attribute.primaryKey && dialect === 'sqlite')) ||
        storageType(column.type) !== storageType(String(attribute.type))
      );
    })
  )
    return false;

  const actualIndexes = await migrationIndexes(queryInterface, table, options);
  if (
    expected.some(
      ([name, attribute]) =>
        attribute.unique === true &&
        !actualIndexes.some(
          (index) =>
            index.unique &&
            index.fields.length === 1 &&
            index.fields[0] === name,
        ),
    )
  )
    return false;
  if (
    !indexes.every((expectedIndex) =>
      actualIndexes.some(
        (index) =>
          index.name === expectedIndex.name &&
          index.unique === Boolean(expectedIndex.unique) &&
          index.fields.length === expectedIndex.fields.length &&
          index.fields.every(
            (field, position) => field === expectedIndex.fields[position],
          ),
      ),
    )
  )
    return false;

  const actualReferences = await migrationForeignKeys(
    queryInterface,
    table,
    options,
  );
  const references = expected.filter(
    ([, attribute]) => attribute.references !== undefined,
  );
  return (
    actualReferences.length === references.length &&
    references.every(([name, attribute]) => {
      const reference = attribute.references;
      if (!reference || typeof reference !== 'object') return false;
      const { model } = reference;
      if (!model || typeof model === 'function') return false;
      const key = storageTableKey(sequelize, model);
      return actualReferences.some(
        (actual) =>
          actual.columnName === name &&
          actual.referencedColumnName === reference.key &&
          (!['mysql', 'mariadb'].includes(dialect) ||
            actual.referencedTableSchema === sequelize.getDatabaseName()) &&
          storageTableKey(
            sequelize,
            dialect === 'postgres'
              ? {
                  tableName: actual.referencedTableName,
                  schema: actual.referencedTableSchema,
                }
              : actual.referencedTableName,
          ) === key,
      );
    })
  );
}

/** Check every target before issuing any DROP, so missing tables stay retryable. */
export async function verifyMigrationTables(
  queryInterface: QueryInterface,
  tables: GuardTableDefinition[],
  options: QueryOptions,
): Promise<TableName[]> {
  const { sequelize } = queryInterface;
  const dialect = sequelize.getDialect();
  const existing: TableName[] = [];
  for (const definition of tables) {
    const name = definition.table;
    const table =
      dialect === 'postgres' && typeof name === 'string'
        ? { tableName: name, schema: 'public' }
        : name;
    if (!(await queryInterface.tableExists(table, options))) continue;
    if (
      !(await hasGuardSchema(queryInterface, { ...definition, table }, options))
    ) {
      const name = typeof table === 'string' ? table : table.tableName;
      throw new Error(
        `Cannot roll back table "${name}": its schema does not match Guard. Verify its ownership before removing it.`,
      );
    }
    existing.push(table);
  }
  if (dialect === 'sqlite' && existing.length) {
    const references = await sequelize.query<{
      source: string;
      target: string;
    }>(
      `SELECT src.name AS source, fk."table" AS target
        FROM sqlite_schema src JOIN pragma_foreign_key_list(src.name) fk
        WHERE src.type = 'table'`,
      { ...options, type: QueryTypes.SELECT },
    );
    const owned = new Set(
      existing.map((table) => storageTableKey(sequelize, table)),
    );
    const dependency = references.find(
      ({ source, target }) =>
        !owned.has(storageTableKey(sequelize, source)) &&
        owned.has(storageTableKey(sequelize, target)),
    );
    if (dependency) {
      throw new Error(
        `Cannot roll back Guard while application table "${dependency.source}" references "${dependency.target}".`,
      );
    }
  }
  if (existing.length && (dialect === 'mysql' || dialect === 'mariadb')) {
    const dependency = await findExternalMySqlReference(
      sequelize,
      existing,
      options,
    );
    if (dependency) {
      throw new Error(
        `Cannot roll back Guard while application table "${dependency.sourceSchema}.${dependency.sourceTable}" references "${dependency.targetTable}".`,
      );
    }
  }
  return existing;
}
