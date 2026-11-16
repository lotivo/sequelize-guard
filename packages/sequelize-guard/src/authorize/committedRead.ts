import type { Sequelize, Transaction } from 'sequelize';

/** SQLite can reuse a transaction's physical connection for an unrelated read. */
export class CommittedReadBarrier {
  private active = 0;
  private revision = 0;
  private sqlActive = 0;

  constructor(sequelize: Sequelize) {
    if (sequelize.getDialect() !== 'sqlite') return;

    // Observe the SQL boundary as well as the public transaction method. This
    // catches a captured transaction method and direct Transaction setup.
    const query = sequelize.query.bind(sequelize);
    sequelize.query = ((sql: unknown, ...args: unknown[]) => {
      const command =
        typeof sql === 'string'
          ? /^\s*(BEGIN|START\s+TRANSACTION|COMMIT|ROLLBACK)\b/i
              .exec(sql)?.[1]
              ?.toUpperCase()
          : undefined;
      const begins = command === 'BEGIN' || command === 'START TRANSACTION';
      const ends =
        command === 'COMMIT' ||
        (command === 'ROLLBACK' && !/^\s*ROLLBACK\s+TO\b/i.test(String(sql)));
      if (begins) {
        this.sqlActive++;
        this.active++;
        this.revision++;
      }
      let task: Promise<unknown>;
      try {
        task = (query as (...values: unknown[]) => Promise<unknown>)(
          sql,
          ...args,
        );
      } catch (error) {
        if (begins) {
          this.sqlActive--;
          this.finish();
        }
        throw error;
      }
      return task.then(
        (value) => {
          if (ends && this.sqlActive) {
            this.sqlActive--;
            this.finish();
          }
          return value;
        },
        (error: unknown) => {
          if (begins) {
            this.sqlActive--;
            this.finish();
          }
          // A failed COMMIT leaves the connection's state uncertain.
          throw error;
        },
      );
    }) as Sequelize['query'];

    const original = sequelize.transaction.bind(sequelize);
    // Sequelize's overloads return either a managed callback result or an
    // unmanaged Transaction. Track both until the actual commit or rollback.
    const wrapped = (...args: unknown[]): Promise<unknown> => {
      this.active++;
      this.revision++;
      const managed = typeof args[args.length - 1] === 'function';
      let result: Promise<unknown>;
      try {
        result = (original as (...values: unknown[]) => Promise<unknown>)(
          ...args,
        );
      } catch (error) {
        this.finish();
        throw error;
      }
      if (managed) return result.finally(() => this.finish());
      return result.then(
        (transaction) => {
          const tx = transaction as Transaction;
          const commit = tx.commit.bind(tx);
          const rollback = tx.rollback.bind(tx);
          let finished = false;
          const finish = () => {
            if (finished) return;
            finished = true;
            this.finish();
          };
          tx.commit = ((...values: unknown[]) =>
            (commit as (...args: unknown[]) => Promise<unknown>)(
              ...values,
            ).finally(finish)) as Transaction['commit'];
          tx.rollback = ((...values: unknown[]) =>
            (rollback as (...args: unknown[]) => Promise<unknown>)(
              ...values,
            ).finally(finish)) as Transaction['rollback'];
          return tx;
        },
        (error: unknown) => {
          this.finish();
          throw error;
        },
      );
    };
    sequelize.transaction = wrapped as Sequelize['transaction'];
  }

  private finish(): void {
    this.active--;
    this.revision++;
  }

  async read<T>(query: () => Promise<T>): Promise<T> {
    if (this.active)
      throw new Error('Authorization read overlaps a SQLite transaction');
    const revision = this.revision;
    const value = await query();
    if (this.active || this.revision !== revision)
      throw new Error('Authorization read overlaps a SQLite transaction');
    return value;
  }
}
