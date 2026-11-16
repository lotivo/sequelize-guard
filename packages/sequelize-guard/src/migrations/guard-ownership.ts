import { createHash } from 'node:crypto';
import { QueryTypes } from 'sequelize';
import type { QueryOptions, Sequelize } from 'sequelize';
import { roleHolderTables } from '../sequelize-models/guard-role-holders';
import {
  guardTable,
  ownedTypes,
  quoteGuardTable,
  storageTableKey,
} from '../sequelize-models/guard-tables';
import { BaseModelType } from '../sequelize-models/types/ModelType';
import { guardUserKey } from '../sequelize-models/user-key';
import type { GuardInternalOptions } from '../types';

type TableEntry = [type: string, physicalName: string];

interface OwnershipReceipt {
  binding: string;
  base: TableEntry[];
  holders: TableEntry[];
}

function compareTypes([first]: TableEntry, [second]: TableEntry): number {
  return first < second ? -1 : Number(first !== second);
}

export function guardOwnership(
  sequelize: Sequelize,
  options: GuardInternalOptions,
) {
  const base = ownedTypes(options)
    .map(
      (type): TableEntry => [
        type,
        storageTableKey(sequelize, guardTable(sequelize, options, type)),
      ],
    )
    .sort(compareTypes);
  const user = guardUserKey(sequelize, options);
  // Bind user authorization to the actual application table and key as well as the Guard namespace.
  const binding = createHash('sha256')
    .update(
      JSON.stringify([
        base,
        storageTableKey(sequelize, user.table),
        user.column,
        user.type.toString({}),
      ]),
    )
    .digest('hex');
  const holders = roleHolderTables(sequelize, options)
    .map(
      ({ type, table }): TableEntry => [
        type,
        storageTableKey(sequelize, table),
      ],
    )
    .sort(compareTypes);
  return { binding, base, holders };
}

export function ownershipPattern({ binding }: OwnershipReceipt): string {
  return `{"binding":"${binding}",%`;
}

export async function readGuardOwnership(
  sequelize: Sequelize,
  options: GuardInternalOptions,
  queryOptions: QueryOptions,
): Promise<OwnershipReceipt | null> {
  const query = sequelize.getQueryInterface();
  const table = guardTable(sequelize, options, BaseModelType.RoleHierarchy);
  const writer = { ...queryOptions, useMaster: true };
  if (!(await query.tableExists(table, writer))) return null;
  const [row] = await sequelize.query<{ ownership: unknown }>(
    `SELECT ownership FROM ${quoteGuardTable(query, table)} WHERE id = 1 AND revision IN (0, 1)`,
    { ...writer, type: QueryTypes.SELECT },
  );
  return parseReceipt(row?.ownership);
}

function parseReceipt(value: unknown): OwnershipReceipt {
  if (typeof value === 'string') {
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'binding' in parsed &&
      typeof parsed.binding === 'string' &&
      'base' in parsed &&
      isTableEntries(parsed.base) &&
      'holders' in parsed &&
      isTableEntries(parsed.holders)
    ) {
      return {
        binding: parsed.binding,
        base: parsed.base,
        holders: parsed.holders,
      };
    }
  }
  throw new Error('Guard table ownership receipt is missing or invalid');
}

function isTableEntries(value: unknown): value is TableEntry[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry: unknown) =>
        Array.isArray(entry) &&
        entry.length === 2 &&
        typeof entry[0] === 'string' &&
        typeof entry[1] === 'string',
    )
  );
}

export function assertMatchingReceipt(
  actual: OwnershipReceipt,
  expected: OwnershipReceipt,
): void {
  assertMatchingBaseReceipt(actual, expected);
  if (JSON.stringify(actual.holders) !== JSON.stringify(expected.holders)) {
    throw new Error(
      'Guard table ownership receipt does not match the configured role holder models',
    );
  }
}

export function assertMatchingBaseReceipt(
  actual: OwnershipReceipt,
  expected: OwnershipReceipt,
): void {
  if (
    actual.binding !== expected.binding ||
    JSON.stringify(actual.base) !== JSON.stringify(expected.base)
  ) {
    throw new Error(
      'Guard table ownership receipt does not match the configured table names or user model',
    );
  }
}

export async function assertOwnedOrEmptySchema(
  sequelize: Sequelize,
  options: GuardInternalOptions,
  queryOptions: QueryOptions,
): Promise<OwnershipReceipt | null> {
  const receipt = await readGuardOwnership(sequelize, options, queryOptions);
  if (receipt) {
    assertMatchingReceipt(receipt, guardOwnership(sequelize, options));
    return receipt;
  }
  const query = sequelize.getQueryInterface();
  const tables = [
    ...ownedTypes(options).map((type) => guardTable(sequelize, options, type)),
    ...roleHolderTables(sequelize, options).map(({ table }) => table),
  ];
  for (const table of tables) {
    if (await query.tableExists(table, { ...queryOptions, useMaster: true })) {
      const name = typeof table === 'string' ? table : table.tableName;
      throw new Error(
        `Existing table "${name}" has no Guard ownership receipt. Existing guard schema requires migration.upgrade before enabling inheritance or managing its tables.`,
      );
    }
  }
  return null;
}

export function ownershipRow(
  sequelize: Sequelize,
  options: GuardInternalOptions,
) {
  return {
    id: 1,
    revision: 0,
    ownership: JSON.stringify(guardOwnership(sequelize, options)),
  };
}

export async function addHolderOwnership(
  sequelize: Sequelize,
  options: GuardInternalOptions,
  receipt: OwnershipReceipt,
  queryOptions: QueryOptions,
): Promise<void> {
  const expected = guardOwnership(sequelize, options);
  const holders = [...receipt.holders, ...expected.holders].sort(compareTypes);
  const query = sequelize.getQueryInterface();
  const table = quoteGuardTable(
    query,
    guardTable(sequelize, options, BaseModelType.RoleHierarchy),
  );
  const updated = await sequelize.query(
    `UPDATE ${table} SET ownership = $updated WHERE id = 1 AND ownership = $previous`,
    {
      ...queryOptions,
      bind: {
        previous: JSON.stringify(receipt),
        updated: JSON.stringify({ ...receipt, holders }),
      },
      type: QueryTypes.BULKUPDATE,
      useMaster: true,
    },
  );
  if (updated !== 1)
    throw new Error(
      'Guard table ownership changed while adding role holders; retry with the current configuration',
    );
}
