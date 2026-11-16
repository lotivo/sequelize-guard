# Independent cloud schema review — 16 November 2026

Reviewed immutable safety checkpoint `d8282c1`, with focused diff `d1c3c36..d8282c1` and the handoff, readiness checklist, foundation review and implementation review as baseline context. This is a schema/ownership review, not release acceptance. No unresolved actionable schema finding was identified in this checkpoint.

## Evidence and conclusions

- `migrations/guard-table-ddl.ts` makes generated CREATE TABLE statements exclusive for all supported dialects and refuses an unexpected statement shape. `migrations/guard-migrations.ts:createIndexedTable` records cleanup ownership only after CREATE succeeds. SQLite dotted physical names are passed to index creation as a table object, preserving the literal name.
- Fresh provisioning and offline upgrade create their ownership receipt after policy tables, holder junctions, indexes and any copy complete. SQLite/PostgreSQL use transactional provisioning. MySQL tracks exclusively created tables for cleanup; failed cleanup leaves an incomplete namespace without a complete receipt, so retries cannot adopt unrelated replacement tables.
- `SequelizeGuard.sync` now routes forced policy teardown through the same verified migration rollback as static down. All targets are checked before destructive DDL. Static migrations exclude supplied user tables and holder application tables. Explicit supplied UserModel sync still receives force/alter options, preserving the retained application contract.
- MySQL down removes the complete receipt before the first implicitly committed DROP. Receipt-removal failure prevents every DROP. Interrupted down consequently refuses automatic retry/adoption and requires deliberate operator recovery. SQLite/PostgreSQL retain transactional rollback. External-reference preflight covers SQLite and all visible MySQL referencing schemas; PostgreSQL DROP restriction and transactional rollback preserve tables when external references reject a drop. MySQL catalog visibility and quiescent DDL remain operational requirements.
- `core/guard-bindings.ts` checks captured routing, exact table identity, model registration, keys, types, timestamp/paranoid settings, defaults, uniqueness, auto-increment, references/delete/update behavior and indexes. The checkpoint adds the relationship/index/default fingerprint and reinitialization regressions requested during this independent review. Caller-owned models and Sequelize objects remain unfrozen. Checks precede sync and linked authorization/mutations, including caller-transaction mutations.
- Receipt identities use exact physical storage keys, with PostgreSQL public qualification normalization, SQLite ASCII-only folding and exact MySQL spelling. Holder junction names include the principal table/key/type hash, preventing a reused holder registration name from inheriting another model's grants. Offline upgrade preserves distinct source/destination ownership and performs legacy-name/graph preflight before destination DDL.

## Executed validation

Node 22.17.1, using `/home/agent/.npm/_npx/7044fed04d28308b/node_modules/node/bin/node`:

```sh
node node_modules/vitest/vitest.mjs run \
  --config packages/sequelize-guard/vite.config.mts \
  ownership.test.ts migrations.test.ts sync.test.ts role-holders.test.ts init.test.ts
```

**5 files passed; 103 tests passed.** The first sandboxed attempt could not write Vite temporary files; the authorized rerun completed successfully. A post-run diff against `d8282c1` confirmed the reviewed source and five focused test files were unchanged. Other agents had unrelated H acceptance files in progress; they are outside this review.

The focused tests exercise final-receipt-write failure and retry, same-shape unrelated-table preservation, SQLite qualified index creation, custom-user and holder isolation, forced sync, live routing/metadata drift, and zero-query rejection before destructive operations. MySQL regression source additionally covers failed receipt insertion, interrupted down/reused names, competing CREATE and failed cleanup. PostgreSQL/MySQL/replication runs are owned by the parent task and were not rerun by this reviewer; their results must be attached separately before final acceptance. No database service, source file or commit was changed by this review.
