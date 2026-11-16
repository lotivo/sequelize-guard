import {
  EmptyResultError,
  Transaction,
  UniqueConstraintError,
} from 'sequelize';
import type {
  Attributes,
  CreationAttributes,
  FindOptions,
  Model,
  ModelStatic,
  Sequelize,
} from 'sequelize';
import type { SequelizeGuardInstance } from '../SequelizeGuard';
import type { PolicyMutationOptions } from '../types';

export interface PolicyMutation {
  transaction: Transaction;
  emitAfterCommit: (event: string, data: object) => void;
}

export const policyBatchSize = 200;

export function canArchiveLinks(model: ModelStatic<Model>): boolean {
  const { timestamps, paranoid, deletedAt } = model.options;
  return Boolean(timestamps && paranoid && deletedAt !== false);
}

const activeCallerTransactions = new WeakSet<Transaction>();
const sqliteTransactions = new WeakMap<Sequelize, Promise<unknown>>();

export async function mutatePolicy<T>(
  guard: SequelizeGuardInstance,
  options: PolicyMutationOptions,
  mutate: (mutation: PolicyMutation) => Promise<T>,
): Promise<T> {
  guard._assertModelBindings();
  const { sequelize } = guard;
  if (options.transaction) {
    const transaction = options.transaction;
    if (!('sequelize' in transaction) || transaction.sequelize !== sequelize) {
      throw new TypeError(
        'Policy transaction must belong to the guard connection',
      );
    }
    if ('parent' in transaction && transaction.parent) {
      throw new TypeError(
        'Policy mutations require the outermost caller transaction',
      );
    }
    if (activeCallerTransactions.has(transaction)) {
      throw new Error(
        'Await each policy mutation before reusing its transaction',
      );
    }
    activeCallerTransactions.add(transaction);
    try {
      return await runPolicyMutation(guard, options, mutate);
    } finally {
      activeCallerTransactions.delete(transaction);
    }
  }

  if (sequelize.getDialect() === 'sqlite') {
    // Sequelize uses one SQLite connection for the entire in-memory database.
    const previous = sqliteTransactions.get(sequelize) ?? Promise.resolve();
    const run = () => runPolicyMutation(guard, options, mutate);
    const task = previous.then(run, run);
    sqliteTransactions.set(sequelize, task);
    try {
      return await task;
    } finally {
      if (sqliteTransactions.get(sequelize) === task)
        sqliteTransactions.delete(sequelize);
    }
  }
  return runPolicyMutation(guard, options, mutate);
}

async function runPolicyMutation<T>(
  guard: SequelizeGuardInstance,
  { transaction }: PolicyMutationOptions,
  mutate: (mutation: PolicyMutation) => Promise<T>,
): Promise<T> {
  guard._assertModelBindings();
  const events: Array<{ event: string; data: object }> = [];
  const options = transaction
    ? { transaction }
    : guard.sequelize.getDialect() === 'sqlite'
      ? { type: Transaction.TYPES.IMMEDIATE }
      : { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED };
  const result = await guard.sequelize.transaction(
    options,
    (activeTransaction) =>
      mutate({
        transaction: activeTransaction,
        emitAfterCommit: (event, data) => {
          if (!transaction) events.push({ event, data });
        },
      }),
  );

  if (!transaction) {
    for (const { event, data } of events) {
      try {
        guard.emit(event, data);
      } catch (error) {
        // A listener failure cannot roll back the committed change.
        process.emitWarning(error instanceof Error ? error : String(error));
      }
    }
  }
  return result;
}

export async function findOrInsertPolicyRecord<T extends Model>(
  model: ModelStatic<T>,
  options: FindOptions<Attributes<T>>,
  values: CreationAttributes<T>,
): Promise<[T, boolean]> {
  const existing = await model.findOne(options);
  if (existing) return [existing, false];

  // Sequelize's nested findOrCreate savepoints can reuse the operation's savepoint name.
  // PostgreSQL needs ON CONFLICT to keep the transaction usable after a concurrent insert.
  const postgres = model.sequelize?.getDialect() === 'postgres';
  try {
    const inserted = await model.create(values, {
      transaction: options.transaction,
      ignoreDuplicates: postgres,
      returning: postgres,
    });
    if (inserted.get(model.primaryKeyAttribute) != null)
      return [inserted, true];
  } catch (error) {
    const conflict = postgres
      ? error instanceof EmptyResultError
      : error instanceof UniqueConstraintError;
    if (!conflict) throw error;

    const winner = await model.findOne(options);
    if (!winner) throw error;
    return [winner, false];
  }

  return [await model.findOne({ ...options, rejectOnEmpty: true }), false];
}
