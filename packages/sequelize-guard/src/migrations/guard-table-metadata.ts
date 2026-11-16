import {
  QueryTypes,
  type QueryInterface,
  type QueryOptions,
  type TableName,
} from 'sequelize';

interface Index {
  name: string;
  unique: boolean;
  fields: string[];
}

interface ForeignKey {
  columnName: string;
  referencedTableName: string;
  referencedTableSchema?: string;
  referencedColumnName: string;
}

function tableAddress(table: TableName, fallbackSchema: string): string[] {
  return typeof table === 'string'
    ? [fallbackSchema, table]
    : [table.schema || fallbackSchema, table.tableName];
}

export async function migrationIndexes(
  queryInterface: QueryInterface,
  table: TableName,
  options: QueryOptions,
): Promise<Index[]> {
  const { sequelize } = queryInterface;
  if (sequelize.getDialect() !== 'postgres') {
    const indexes = (await queryInterface.showIndex(table, options)) as {
      name: string;
      unique: boolean;
      partial?: boolean | number;
      fields: { attribute: string; length?: number }[];
    }[];
    return indexes
      .filter(
        (index) =>
          !index.partial &&
          index.fields.every(
            (field) => field.length === undefined || field.length === null,
          ),
      )
      .map(({ name, unique, fields }) => ({
        name,
        unique,
        fields: fields.map((field) => field.attribute),
      }));
  }

  return sequelize.query<Index>(
    `
    SELECT idx.relname AS name, ix.indisunique AS "unique",
      ARRAY(
        SELECT attr.attname::text
        FROM unnest(ix.indkey) WITH ORDINALITY AS keys(attnum, position)
        JOIN pg_catalog.pg_attribute attr
          ON attr.attrelid = tbl.oid AND attr.attnum = keys.attnum
        WHERE keys.position <= ix.indnkeyatts
        ORDER BY keys.position
      ) AS fields
    FROM pg_catalog.pg_index ix
    JOIN pg_catalog.pg_class idx ON idx.oid = ix.indexrelid
    JOIN pg_catalog.pg_class tbl ON tbl.oid = ix.indrelid
    JOIN pg_catalog.pg_namespace ns ON ns.oid = tbl.relnamespace
    WHERE ns.nspname = $1 AND tbl.relname = $2
      AND ix.indisvalid AND ix.indpred IS NULL AND ix.indexprs IS NULL
  `,
    {
      ...options,
      type: QueryTypes.SELECT,
      bind: tableAddress(table, 'public'),
    },
  );
}

export async function migrationForeignKeys(
  queryInterface: QueryInterface,
  table: TableName,
  options: QueryOptions,
): Promise<ForeignKey[]> {
  const { sequelize } = queryInterface;
  switch (sequelize.getDialect()) {
    case 'postgres':
      return sequelize.query<ForeignKey>(
        `
        SELECT col.attname AS "columnName", target.relname AS "referencedTableName",
          target_ns.nspname AS "referencedTableSchema", target_col.attname AS "referencedColumnName"
        FROM pg_catalog.pg_constraint fk
        JOIN pg_catalog.pg_class tbl ON tbl.oid = fk.conrelid
        JOIN pg_catalog.pg_namespace ns ON ns.oid = tbl.relnamespace
        JOIN pg_catalog.pg_class target ON target.oid = fk.confrelid
        JOIN pg_catalog.pg_namespace target_ns ON target_ns.oid = target.relnamespace
        JOIN unnest(fk.conkey) WITH ORDINALITY AS keys(attnum, position) ON TRUE
        JOIN pg_catalog.pg_attribute col
          ON col.attrelid = tbl.oid AND col.attnum = keys.attnum
        JOIN pg_catalog.pg_attribute target_col
          ON target_col.attrelid = target.oid AND target_col.attnum = fk.confkey[keys.position]
        WHERE ns.nspname = $1 AND tbl.relname = $2 AND fk.contype = 'f'
      `,
        {
          ...options,
          type: QueryTypes.SELECT,
          bind: tableAddress(table, 'public'),
        },
      );
    case 'mysql':
    case 'mariadb':
      return sequelize.query<ForeignKey>(
        `
        SELECT COLUMN_NAME AS columnName, REFERENCED_TABLE_NAME AS referencedTableName,
          REFERENCED_TABLE_SCHEMA AS referencedTableSchema, REFERENCED_COLUMN_NAME AS referencedColumnName
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = $1 AND TABLE_NAME = $2 AND REFERENCED_TABLE_NAME IS NOT NULL
      `,
        {
          ...options,
          type: QueryTypes.SELECT,
          bind: tableAddress(table, sequelize.getDatabaseName()),
        },
      );
    default:
      return (await queryInterface.getForeignKeyReferencesForTable(
        table,
        options,
      )) as ForeignKey[];
  }
}

interface MySqlReference {
  sourceSchema: string;
  sourceTable: string;
  targetSchema: string;
  targetTable: string;
  lowerCaseTableNames: number;
}

export async function findExternalMySqlReference(
  sequelize: QueryInterface['sequelize'],
  tables: TableName[],
  options: QueryOptions,
): Promise<MySqlReference | undefined> {
  const database = sequelize.getDatabaseName();
  const names = tables.map((table) => tableAddress(table, database)[1]);
  const parameters = names.map((_, index) => '$' + (index + 2)).join(', ');
  const references = await sequelize.query<MySqlReference>(
    `SELECT DISTINCT TABLE_SCHEMA AS sourceSchema, TABLE_NAME AS sourceTable,
        REFERENCED_TABLE_SCHEMA AS targetSchema, REFERENCED_TABLE_NAME AS targetTable,
        @@lower_case_table_names AS lowerCaseTableNames
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE REFERENCED_TABLE_SCHEMA = $1 AND REFERENCED_TABLE_NAME IN (${parameters})`,
    { ...options, type: QueryTypes.SELECT, bind: [database, ...names] },
  );
  return references.find((reference) => {
    const normalize = (name: string) =>
      reference.lowerCaseTableNames === 0 ? name : name.toLowerCase();
    const owned = (schema: string, table: string) =>
      normalize(schema) === normalize(database) &&
      names.some((name) => normalize(name) === normalize(table));
    return (
      owned(reference.targetSchema, reference.targetTable) &&
      !owned(reference.sourceSchema, reference.sourceTable)
    );
  });
}
