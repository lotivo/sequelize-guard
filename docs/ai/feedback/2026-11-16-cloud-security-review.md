# Independent cloud security review — 16 November 2026

Reviewed immutable implementation checkpoint `d8282c1`, with continuation diff `d1c3c36..d8282c1` and the retained A/F implementation and handoff reviews as supporting context. This is a focused authorization and data-integrity review, not release acceptance. No actionable security finding remains in the inspected paths.

## Scope and conclusions

- Reviewed permission grammar, canonical action-set identity, exact-token revocation and writer-backed authorization. Malformed persisted grants do not grant access; infrastructure failures remain errors. The bounded permission projection retains case-sensitive evaluation and validates the complete inherited role lineage.
- Reviewed direct memberships versus inherited permissions, cycle/orphan handling, active users/registered holders and separate holder junction identities. Holder junction naming binds the application table, key and key type; identical IDs in different models do not share grants.
- Reviewed binding checks and lock ordering across permission creation, both role-grant overloads, revocation, membership mutations and hierarchy edits. The hierarchy binding write precedes policy row locks. Live Sequelize routing, model registration, physical identity, primary-key/paranoid metadata, references and indexes are captured without freezing caller-owned Sequelize/model objects. Drift rejects before linked authorization/mutation and sync database work.
- Reviewed archived membership and permission-junction restoration, including residual grants produced by action revocation. Explicit restoration preserves link identity, counts only inactive memberships and shares the operation transaction. Caller savepoint failure rolls back restoration and new rows; caller transactions suppress built-in events. Guard-owned event delivery occurs after successful commit.
- Reviewed ownership provisioning and forced sync: exclusive table creation and final receipt insertion prevent an incomplete creation from claiming names never created. Forced sync uses the migration ownership/external-reference checks before dropping owned tables. MySQL rollback revokes the complete receipt before its first nontransactional DROP, so interrupted rollback cannot subsequently adopt or drop reused names automatically.

The prior handoff concerns about permission mutation binding bypass and incomplete schema receipts are addressed in the reviewed implementation. SQLite schema-qualified physical index names now use table-name metadata rather than accidental SQL qualification. Initialization coverage uses real DDL and receipt assertions instead of weakening the previous mock.

## Independent verification

Source under `packages/sequelize-guard/src` matched `d8282c1` before and after the focused runs (`git diff d8282c1 -- packages/sequelize-guard/src` was empty).

On **each** of Node **22.17.1** and **24.15.0**, Vitest **4.1.12** passed:

- 146 tests in 11 suites: `policy`, `revocation`, `authorize`, `role-hierarchy`, `role-holders`, `archived-grants`, `bulk-assignments`, `events`, `sync`, `migrations`, and `ownership`.
- 36 tests in `init.test.ts`, including the repaired real migration initialization cases.

Total: **182 independently executed tests per Node line**, with no failures. Commands used the exact configured Node executables and `node_modules/vitest/vitest.mjs run --config packages/sequelize-guard/vite.config.mts` with the listed suite filenames. Normal Vite/test temporary-file writes required sandbox escalation; no source changes were made.

## Limits

No shared database services were used. PostgreSQL/MySQL concurrency, nontransactional DDL and physical replication regressions were inspected in source but were not independently executed in this review; the orchestrator owns that matrix. Existing MySQL operational requirements for metadata visibility and quiescent migration DDL still apply. This report does not cover later documentation/package/release changes or authorize publication. The only authored file is this report; no implementation edits or commit were made.
