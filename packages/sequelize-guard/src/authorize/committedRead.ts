import type { Sequelize, Transaction } from 'sequelize';

/** SQLite can reuse a transaction's physical connection for an unrelated read. */
export class CommittedReadBarrier {
  private active = 0;
  private revision = 0;
  private readonly sqlScopes: Array<string | null> = [];
  private probed = false;
  private probeTask?: Promise<void>;
  private readonly pendingQueries = new Set<Promise<unknown>>();
  private readonly sqlite: boolean;

  constructor(private readonly sequelize: Sequelize) {
    this.sqlite = sequelize.getDialect() === 'sqlite';
    if (!this.sqlite) return;

    // Observe the actual SQL even when query() was captured before the guard
    // was constructed. beforeQuery runs after Sequelize selects the connection.
    sequelize.addHook('beforeQuery', (options, query) => {
      const target = query as unknown as {
        run: (...args: unknown[]) => Promise<unknown>;
      };
      const run = target.run.bind(query);
      target.run = async (sql: unknown, ...args: unknown[]) => {
        const probe = (
          options as typeof options & { guardCommittedProbe?: boolean }
        ).guardCommittedProbe;
        if (!probe && this.probeTask)
          await this.probeTask.catch(() => undefined);
        const task = this.observeSql(String(sql), () => run(sql, ...args));
        if (!probe) {
          this.pendingQueries.add(task);
          void task.then(
            () => this.pendingQueries.delete(task),
            () => this.pendingQueries.delete(task),
          );
        }
        return task;
      };
    });

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

  private async observeSql<T>(sql: string, run: () => Promise<T>): Promise<T> {
    const statement = sql
      .replace(/^(?:;|\s|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)+/, '')
      .trim();
    const beginsTransaction = /^(?:BEGIN|START\s+TRANSACTION)\b/i.test(
      statement,
    );
    const savepoint = /^SAVEPOINT\b([\s\S]*)/i.exec(statement);
    const begins = beginsTransaction || Boolean(savepoint);
    // sqlite3 can accept a line-comment-only first statement without running
    // the control SQL after it. Never clear uncertainty from a commented end.
    const closing = sql.trim();
    const release = /^RELEASE(?:\s+SAVEPOINT)?\s+([\s\S]+)/i.exec(closing);
    const rollbackTo =
      /^ROLLBACK(?:\s+TRANSACTION)?\s+TO(?:\s+SAVEPOINT)?\s+([\s\S]+)/i.exec(
        closing,
      );
    const ends =
      /^(?:COMMIT|END)\b/i.test(closing) ||
      // Only a whole-transaction rollback clears uncertainty. A rollback
      // to a savepoint can contain comments between its SQL tokens.
      /^ROLLBACK(?:\s+TRANSACTION)?\s*;?\s*$/i.test(closing);
    if (begins) {
      this.sqlScopes.push(savepoint ? savepointName(savepoint[1]) : null);
      this.active++;
      this.revision++;
    }
    try {
      const value = await run();
      if (ends) {
        this.dropScopesFrom(0);
      } else if (release) {
        const name = savepointName(release[1]);
        const index = name === null ? -1 : this.sqlScopes.lastIndexOf(name);
        if (index >= 0) this.dropScopesFrom(index);
      } else if (rollbackTo) {
        const name = savepointName(rollbackTo[1]);
        const index = name === null ? -1 : this.sqlScopes.lastIndexOf(name);
        if (index >= 0) this.dropScopesFrom(index + 1);
      }
      return value;
    } catch (error) {
      if (begins) {
        this.sqlScopes.pop();
        this.finish();
      }
      // A failed COMMIT leaves the connection's state uncertain.
      throw error;
    }
  }

  private dropScopesFrom(index: number): void {
    while (this.sqlScopes.length > index) {
      this.sqlScopes.pop();
      this.finish();
    }
  }

  private async ensureProbed(): Promise<void> {
    if (!this.sqlite || this.probed) return;
    if (!this.probeTask) {
      this.probeTask = (async () => {
        await Promise.allSettled([...this.pendingQueries]);
        const probeOptions = { transaction: null, guardCommittedProbe: true };
        try {
          // A nested BEGIN fails on the shared in-memory connection. Probe on
          // first read so sync:false ready stays free of database queries.
          await this.sequelize.query(
            'BEGIN DEFERRED TRANSACTION',
            probeOptions,
          );
        } catch (error) {
          if (
            /cannot start a transaction within a transaction/i.test(
              String(error),
            )
          )
            throw new Error(
              'Authorization read overlaps a SQLite transaction',
              { cause: error },
            );
          throw error;
        }
        await this.sequelize.query('ROLLBACK', probeOptions);
        this.probed = true;
      })().finally(() => {
        this.probeTask = undefined;
      });
    }
    await this.probeTask;
  }

  private finish(): void {
    this.active--;
    this.revision++;
  }

  async read<T>(query: () => Promise<T>): Promise<T> {
    if (this.active)
      throw new Error('Authorization read overlaps a SQLite transaction');
    await this.ensureProbed();
    if (this.active)
      throw new Error('Authorization read overlaps a SQLite transaction');
    const revision = this.revision;
    const value = await query();
    if (this.active || this.revision !== revision)
      throw new Error('Authorization read overlaps a SQLite transaction');
    return value;
  }
}

function savepointName(value: string): string | null {
  const input = value
    .replace(/^(?:\s|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)+/, '')
    .trim();
  const quoted = /^"((?:[^"]|"")*)"/.exec(input);
  if (quoted) return quoted[1].replace(/""/g, '"').toLowerCase();
  const single = /^'((?:[^']|'')*)'/.exec(input);
  if (single) return single[1].replace(/''/g, "'").toLowerCase();
  const backtick = /^`((?:[^`]|``)*)`/.exec(input);
  if (backtick) return backtick[1].replace(/``/g, '`').toLowerCase();
  const bracket = /^\[([^\]]+)\]/.exec(input);
  if (bracket) return bracket[1].toLowerCase();
  return /^([^\s;]+)/.exec(input)?.[1]?.toLowerCase() ?? null;
}
