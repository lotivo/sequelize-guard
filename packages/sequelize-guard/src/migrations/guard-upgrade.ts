import {
  QueryTypes,
  Utils,
  type QueryInterface,
  type QueryOptions,
  type TableName,
} from 'sequelize';
import {
  BaseModelType,
  type ModelType,
} from '../sequelize-models/types/ModelType';
import type { GuardInternalOptions, GuardOptions } from '../types';
import { guardColumns, timestampColumns } from './guard-schema';

export interface GuardUpgradeOptions {
  /** Options describing the existing installation's actual tables. */
  from: GuardOptions;
  /** Options for wholly distinct destination tables. */
  to: GuardOptions;
}

type GuardTable = { type: ModelType; table: TableName };

export async function copyGuardTables(
  queryInterface: QueryInterface,
  source: GuardInternalOptions,
  target: GuardInternalOptions,
  sourceTables: GuardTable[],
  targetTables: GuardTable[],
  options: QueryOptions,
): Promise<() => Promise<void>> {
  const { sequelize } = queryInterface;
  const identifier = (column: string) =>
    queryInterface.quoteIdentifier(column, true);
  const quoteTable = (table: TableName) =>
    typeof table === 'string'
      ? identifier(table)
      : (table.schema ? [table.schema, table.tableName] : [table.tableName])
          .map(identifier)
          .join('.');
  const targetColumns = guardColumns(sequelize, target);
  const configuredSourceDates = timestampColumns(sequelize, source);
  const targetDates = timestampColumns(sequelize, target);
  if (
    configuredSourceDates.map(({ name }) => name).join() !==
    targetDates.map(({ name }) => name).join()
  ) {
    throw new Error(
      'Guard upgrade requires the same timestamp and effective paranoid settings',
    );
  }

  const copies: {
    type: ModelType;
    from: string;
    to: string;
    columns: string[];
    mappings: string[];
  }[] = [];
  for (const [index, { type, table: sourceTable }] of sourceTables.entries()) {
    const targetTable = targetTables[index].table;
    const from = quoteTable(sourceTable);
    const to = quoteTable(targetTable);
    const sourceColumns = await queryInterface.describeTable(
      sourceTable,
      options,
    );
    const columns = Object.keys(targetColumns[type]);
    const mappings = columns.map((column) => {
      const timestamp = targetDates.find((date) => date.column === column);
      if (!timestamp) {
        if (Object.hasOwn(sourceColumns, column)) return column;
        throw new Error(`Missing guard column ${column} in ${from}`);
      }
      const candidates = new Set([
        timestamp.column,
        timestamp.name,
        Utils.underscoredIf(timestamp.name, true),
      ]);
      const matches = [...candidates].filter((name) =>
        Object.hasOwn(sourceColumns, name),
      );
      if (matches.length !== 1) {
        throw new Error(
          `Expected one legacy column for ${timestamp.name} in ${from}`,
        );
      }
      return matches[0];
    });

    const extras = Object.keys(sourceColumns).filter(
      (column) => !mappings.includes(column),
    );
    if (
      !source.timestamps &&
      source.paranoid &&
      extras.includes('deleted_at')
    ) {
      const inactive = await sequelize.query(
        `SELECT 1 FROM ${from} WHERE ${identifier('deleted_at')} IS NOT NULL LIMIT 1`,
        { ...options, type: QueryTypes.SELECT },
      );
      if (inactive.length === 0) extras.splice(extras.indexOf('deleted_at'), 1);
    }
    if (extras.length) {
      throw new Error(
        `Unexpected guard columns in ${from}: ${extras.join(', ')}`,
      );
    }

    copies.push({ type, from, to, columns, mappings });
  }

  return async () => {
    const id = identifier('id');
    const parentId = identifier('parent_id');
    const dialect = sequelize.getDialect();
    for (const { type, from, to, columns, mappings } of copies) {
      if (dialect === 'mysql') {
        // MySQL can turn an explicitly copied AUTO_INCREMENT zero into a new ID.
        const zero = await sequelize.query(
          `SELECT 1 FROM ${from} WHERE ${id} = 0`,
          {
            ...options,
            type: QueryTypes.SELECT,
          },
        );
        if (zero.length)
          throw new Error(
            `Cannot preserve an auto-increment ID of zero in ${from}`,
          );
      }
      const values = mappings.map((column) =>
        type === BaseModelType.Roles && column === 'parent_id'
          ? 'NULL'
          : identifier(column),
      );
      await sequelize.query(
        `INSERT INTO ${to} (${columns.map(identifier).join(', ')}) SELECT ${values.join(', ')} FROM ${from}`,
        options,
      );
      if (type === BaseModelType.Roles) {
        await sequelize.query(
          `UPDATE ${to} AS target_roles SET ${parentId} = (SELECT source_roles.${parentId} FROM ${from} AS source_roles WHERE source_roles.${id} = target_roles.${id})`,
          options,
        );
      }
      if (dialect === 'postgres') {
        await sequelize.query(
          `SELECT setval(pg_get_serial_sequence($1, 'id'), GREATEST(COALESCE(MAX(${id}), 0), 1), COALESCE(MAX(${id}), 0) >= 1) FROM ${to}`,
          { ...options, bind: [to], type: QueryTypes.SELECT },
        );
      }
    }
  };
}
