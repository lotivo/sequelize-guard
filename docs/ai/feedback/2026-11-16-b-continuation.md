# B continuation — migration ownership and failure recovery

The cloud continuation replaces the two obsolete initialization migration stubs with real SQLite DDL assertions. They verify exclusive CREATE statements in dependency order, actual table existence, and the final ownership row. Production exclusive creation remains mandatory; no fallback to `CREATE TABLE IF NOT EXISTS` was added.

SQLite model defaults containing a schema produce physical names such as `tenant.guard_roles`. Migration index creation now passes that complete name as `tableName` so Sequelize quotes it as one identifier. A real migration up/down test inspects the created index. C's coordinated sync change drops the old receipt through migration rollback before forced reprovisioning, rather than retaining a complete receipt across missing tables.

Fresh creation and upgrade continue to write their complete receipt only after exclusive table creation, indexes, and any upgrade copy succeed. The SQLite final receipt-write failure regression proves transactional cleanup, refuses subsequent adoption/drop of a coincidentally shaped application table, and permits a fresh retry after that application table is explicitly removed. MySQL tests cover competing creates, cleanup after a failed final receipt write, and a creation whose cleanup also fails. Incomplete creations have no complete receipt; subsequent up/down refuse adoption or deletion of names they never created.

MySQL rollback now deletes the ownership row only after all ownership, shape, and external-reference preflights pass, and before the first nontransactional DROP. If receipt deletion fails, no DROP runs. If a later DROP fails, the remaining schema is deliberately unusable through normal Guard operations: retrying down rejects the invalid receipt and up rejects the existing tables. A regression recreates an already-dropped name as an unrelated table and verifies neither retry drops it. PostgreSQL and SQLite retain transactional rollback and ordinary retry behavior. Existing missing-table rollback behavior is distinct from an interrupted MySQL DDL run.

## Operator recovery limitation for MySQL

MySQL DDL implicitly commits. A failed creation whose cleanup fails, or an interrupted rollback after receipt deletion, requires manual recovery during a maintenance window with DDL quiescent. Keep the failure and cleanup errors, configured exact physical names, schema backup, and executed DDL log. Inspect remaining tables and incoming application references against that evidence. Back up any data to retain. Explicitly remove only tables proven to belong to the interrupted operation, in junction-before-parent order; preserve unrelated tables even when their names match configuration. Once that namespace is empty, rerun migration up. Restore a backup instead when policy data must be recovered. Never invent or reinsert a complete ownership receipt to bypass these checks. Automatic recovery cannot safely distinguish a table retained by failed DDL from a subsequently reused unrelated name.

## Verification recorded during continuation

- Node 22.17.1: focused initialization/migrations/sync suite passed 85 tests before additional C tests landed; final integrated acceptance belongs to the orchestrator.
- Node 24.15.0: B initialization and migration suites passed; the concurrent C holder-binding regression initially failed in its mutation path and was reported to C/F for correction.
- Real MySQL 8.4, both Node lines: `dialect.integration.ts` passed 8 tests, 1 PostgreSQL-only test skipped.
- Real PostgreSQL 17, Node 24.15.0: `dialect.integration.ts` passed 4 tests, 5 MySQL-only tests skipped. Node 22 passed the same 4 PostgreSQL tests before the final MySQL-only case was added.
- Node 22 library TypeScript check passed after C corrected its test's readonly assignment. ESLint passed the four changed B TypeScript files before the final MySQL cleanup test addition; the orchestrator reruns final integrated lint/checks.

B changed `migrations/guard-migrations.ts`, `__tests__/init.test.ts`, `__tests__/migrations.test.ts`, and `__tests__/dialect.integration.ts` under `packages/sequelize-guard/src`, plus this handoff. No checklist item is marked complete solely from these focused runs. Full integrated tests, holder dialect tests, replication, package acceptance, and final reviews remain orchestrator responsibilities.
