import {
  QueryTypes,
  Utils,
  type QueryInterface,
  type ModelAttributes,
  type QueryOptions,
  type TableName,
} from 'sequelize';
import { assertRoleForest } from '../guard/RoleHierarchy';
import {
  hasRoleHierarchy,
  quoteGuardTable,
} from '../sequelize-models/guard-tables';
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
  /** Turn previously inactive legacy parent links into inherited permissions. */
  inheritExistingParents?: boolean;
}

type GuardTable = {
  type: ModelType;
  table: TableName;
  attributes?: ModelAttributes;
};

export async function copyGuardTables(
  queryInterface: QueryInterface,
  source: GuardInternalOptions,
  target: GuardInternalOptions,
  sourceTables: GuardTable[],
  targetTables: GuardTable[],
  options: QueryOptions,
  inheritExistingParents: boolean,
): Promise<() => Promise<void>> {
  const { sequelize } = queryInterface;
  const identifier = (column: string) =>
    queryInterface.quoteIdentifier(column, true);
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
    const targetTable = targetTables[index];
    const from = quoteGuardTable(queryInterface, sourceTable);
    const to = quoteGuardTable(queryInterface, targetTable.table);
    const sourceColumns = await queryInterface.describeTable(
      sourceTable,
      options,
    );
    const columns = Object.keys(targetTable.attributes ?? targetColumns[type]);
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

    if (type === BaseModelType.Roles) {
      const deletedColumn = targetDates.find(
        ({ name }) => name === 'deletedAt',
      );
      const deletedAt =
        deletedColumn && mappings[columns.indexOf(deletedColumn.column)];
      const active = deletedAt
        ? `CASE WHEN ${identifier(deletedAt)} IS NULL THEN 1 ELSE 0 END`
        : '1';
      const roles = await sequelize.query<{
        id: number;
        name: string;
        parent_id: number | null;
        active: number;
      }>(
        `SELECT ${identifier('id')}, ${identifier('name')}, ${identifier('parent_id')}, ${active} AS active FROM ${from}`,
        {
          ...options,
          type: QueryTypes.SELECT,
        },
      );
      assertCanonicalLegacyRoles(roles);
      if (
        roles.some(({ parent_id }) => parent_id != null) &&
        !inheritExistingParents &&
        !(await hasRoleHierarchy(sequelize, source, options))
      ) {
        throw new Error(
          'Legacy parent links require inheritExistingParents: true to activate inherited permissions',
        );
      }
      assertRoleForest(roles.filter(({ active }) => Number(active) === 1));
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

function assertCanonicalLegacyRoles(
  roles: { id: number; name: string }[],
): void {
  const remediation =
    'Resolve the role names in the offline source, preserving role IDs and reviewing memberships, then retry.';
  const canonical = new Map<string, number>();
  let noncanonical: number | undefined;
  for (const { id, name } of roles) {
    const normalized =
      typeof name === 'string' ? name.trim().toLowerCase() : '';
    if (!normalized || normalized !== name) noncanonical ??= id;
    const previous = canonical.get(normalized);
    if (previous !== undefined) {
      throw new Error(
        `Legacy role names collide after normalization (IDs ${previous} and ${id}). ${remediation}`,
      );
    }
    canonical.set(normalized, id);
  }
  if (noncanonical !== undefined) {
    throw new Error(
      `Noncanonical legacy role name (ID ${noncanonical}). ${remediation}`,
    );
  }
}
