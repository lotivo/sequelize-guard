# Public contract acceptance matrix — 16 November 2026

This matrix maps the supported API families to normal (N), empty (E), invalid
(I), repeated (R), concurrent (C), and infrastructure failure (F) cases. File
names below refer to `packages/sequelize-guard/src/__tests__/`. A test file is
coverage evidence for its named scenarios, not proof of every input combination.
`—` means no independent scenario applies; `unsupported` means outside the declared TypeScript input contract.
The release checklist remains the authority for release acceptance.

| Operations                                                                                                         | N                                                                         | E / absent                                                             | I                                                                                        | R                                                                          | C                                                         | F                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| constructor, `ready`, `sync`, `models`                                                                             | init, sync                                                                | sync: zero SQL with `sync:false`                                       | init, sync: conflicting models/options/bindings                                          | init: one owner; sync: retry                                               | sync: serialized calls; migrations: competing creators    | sync, migrations: provisioning/receipt retry                                                                              |
| `makeRole`, `makeRoles`                                                                                            | roles, policy                                                             | roles: empty name rejected                                             | policy: normalization/name collisions                                                    | roles, policy: deduplication                                               | policy: concurrent creation                               | policy: rollback / failed commit                                                                                          |
| `getRole`, `findRoles`, `allRoles`                                                                                 | roles                                                                     | roles: missing/null and empty search means all                         | policy: noncanonical persisted names; unsupported: arbitrary JS search argument shapes   | policy: fresh cross-connection reads                                       | policy: external writes                                   | performance-contracts: warmed writer reads reject                                                                         |
| `deleteRoles`                                                                                                      | roles, policy                                                             | roles: missing returns zero                                            | roles: invalid inputs; policy: safeguard                                                 | roles: absent after deletion                                               | policy: in-progress grant protects new association        | policy: managed commit failure; performance-contracts: destructive cleanup rollback                                       |
| `createPerms`, `createPermsBulk`, `findPerms`                                                                      | permissions; policy: canonical bundles                                    | policy: empty actions/resources reject; permissions: omitted search    | policy: malformed grammar / conflicting explicit name                                    | permissions, policy: reordered/deduplicated actions                        | policy: serialized creation through grant operations      | policy: atomic conflict; performance-contracts: partial bulk insertion rollback                                           |
| `allow`, `addPermsToRole`, `rmPermsFromRole`                                                                       | policy, roles                                                             | roles: missing removal; policy: empty inputs                           | policy: grammar, incompatible stored definitions                                         | policy: canonical identity, wildcard removal, no duplicate events          | policy, revocation: overlapping grants/removals           | policy: transaction rollback, savepoints and commit failure; archived-grants                                              |
| `makeUser` and configured model creation                                                                           | users, migrations, package strict types                                   | users: default attributes; custom required fields via configured model | init/migrations: unsupported model/key; package strict negative types                    | users: distinct users                                                      | — independent inserts owned by Sequelize                  | performance-contracts: rejected insert leaves no user                                                                     |
| `assignRole`, `assignRoles`, `assignRolesToUsers`, `assignUserRoles`, `rmAssignedRoles` and user aliases           | users, bulk-assignments                                                   | bulk-assignments: zero for empty input; revocation: repeated removal   | bulk-assignments: stale/unsaved/foreign users, bad collection shapes                     | bulk-assignments: deduplicated count, archived links                       | bulk-assignments: cross-connection unique links           | bulk-assignments, policy: insert rollback, caller savepoints                                                              |
| `getUserRoles`, `userHasRoles`, `userHasAllRoles`, `userIsA` and `roles/getRoles/isA/isAn/isAnyOf/isAllOf` aliases | authorize, revocation                                                     | revocation: any([])=false, all([])=true, no membership=[]              | role-hierarchy: noncanonical stored names; unsupported: invalid runtime role-list shapes | revocation: warmed checks / cross-connection removal                       | revocation: delayed earlier read cannot repopulate access | revocation: query failure rejects                                                                                         |
| `userCan`, `userCant`, user `can/cant`, `resolvePermission`                                                        | authorize, policy                                                         | policy: malformed/empty request denies                                 | policy, performance-contracts: grammar, stored malformed JSON, exact case                | revocation: no warmed permission reuse                                     | revocation: cross-connection grant/revoke                 | revocation: warmed checks reject database failure                                                                         |
| `setRoleParent`                                                                                                    | role-hierarchy: inherited permissions, direct role checks                 | role-hierarchy: detach with null                                       | role-hierarchy: self/cycle/missing/inactive parent                                       | role-hierarchy: reparent; performance-contracts: repeated identical parent | role-hierarchy: competing cycle edits                     | role-holders: caller transaction/savepoint; performance-contracts: rejected graph commit preserves access                 |
| `assignRolesToHolder`, `removeRolesFromHolder`, `getHolderRoles`, `holderCan`                                      | role-holders: typed principals, inheritance                               | role-holders: no roles / removed grants                                | role-holders: unregistered model, inactive principal, binding drift                      | role-holders: assignments/restoration                                      | role-holders: shared membership lock; dialect integration | role-holders: rollback/savepoint; performance-contracts: warmed holder read/check reject                                  |
| `init`, builder `allow/to/on/commit`                                                                               | control                                                                   | control: incomplete stays editable, consumed complete statement        | control: invalid input preserves statement                                               | control: reuse and failure consumption                                     | control: next statement while previous commit pending     | control, policy: persistence failure consumes completed statement                                                         |
| `getCache/resetCache`, `getUserCache/resetUserCache`                                                               | misc, init                                                                | revocation: no cached membership                                       | — manual cache is not policy authority                                                   | init: stable listeners and one manual sweeper                              | — no authorization decisions from cache                   | — synchronous local helpers; database-backed policy refresh failure covered by sync                                       |
| event subscriptions (`on/once`, unsubscribe, convenience listeners, `emit`)                                        | events, policy                                                            | policy: no change means no event                                       | — application-defined event names/payloads                                               | events: once/unsubscribe                                                   | policy: events after managed commit only                  | policy: no events for failed/caller-owned transactions                                                                    |
| `migration.up/down/upgrade/addRoleHolders`                                                                         | migrations, role-holders, dialect integrations, package upgrade fixture   | migrations: no owned tables / distinct target                          | migrations, ownership: schemas, keys, names, graph, external references                  | migrations: idempotent/retry and receipts                                  | migrations: competing exclusive creators                  | migrations: partial creation, receipt failure and retry; live dialect/standby evidence owned by B                         |
| native ESM/CJS imports, exported `migration`, default/named constructors, public types                             | scripts/test-package.mjs: installed archive, strict mts/cts/bundler modes | —                                                                      | negative TypeScript cases, manifest/content allowlist                                    | fresh consumer each invocation                                             | —                                                         | installed upgrade fixture; shared installed examples: authentication, administration, revocation, infrastructure failures |

Direct failure families are exercised in `performance-contracts` alongside the
shared mutation/savepoint regressions. Wrapper aliases share the same invariants;
this matrix does not enumerate every permutation of application input. User-owned
Sequelize model operations and arbitrary custom application code are outside the
library's regression matrix. No conditional assertion skips were found in SQLite
`*.test.ts` files: remaining `if` statements select fixture variants, collect SQL,
assert required setup exists, or clean up unfinished transactions.

## Large policy and query bounds

- `bulk-assignments`: 480 memberships cross membership batching; a 2,500-action
  grant preserves its final token and literal SQL-looking resource; malformed
  stored arrays containing a wildcard and a non-string deny.
- `role-hierarchy`: 256-level valid lineage authorizes in one writer query;
  introducing a cycle denies and graph mutation rejects. No fixed supported
  maximum depth is promised; database recursion and resource limits still apply.
- `performance-contracts`: 128-level lineage with 2,000 irrelevant grants returns
  129 projected rows for an exact allow, 128 for a case-mismatch deny, each in one
  writer query. A noncanonical intermediate role with no matching grant rejects.
  Every ancestor is still validated; SQL filtering does not hide corrupt lineage.
- `performance-contracts`: 10,000 nested arrays, 10,000 valid tokens plus wildcard
  and null, and 100KB truncated JSON deny. A separate valid grant still allows.
  These are correctness/resource regression samples, not policy size limits or a
  guarantee against arbitrarily large attacker-controlled database values.
- Row projection is proportional to valid ancestry plus matching/wildcard grants,
  rather than every unrelated grant. The recursive CTE still traverses memberships
  and lineage; one query does not mean constant database work or constant memory.
- Writer routing is asserted in revocation and performance contracts; physical
  standby behavior requires the separate B integration harness. Authorization and
  a subsequent application write remain separate operations.

## Performance evidence

Run `node --expose-gc scripts/benchmark-authorization.mjs` after a fresh build.
The script reports Node/machine details, built ESM SHA256, p50/p95, query counts,
heap sampled between runs, and post-GC retained heap. All checks include schema
binding validation. Sequential SQLite results do not measure service concurrency,
production latency, peak allocations or PostgreSQL/MySQL query plans. Final
integrated run results and exact stable/RC artifact acceptance must be recorded
below after documentation and packaged skill contents settle.

### Integrated benchmark sample

Measured on Linux x64, AMD EPYC 9V74, 5 visible logical CPUs, 17.59GiB system memory. Built ESM SHA256: `bffce88bbfb863a1f78dfe2f024f44c081318b09b35a74f7301d830e907f0068`. Two registered application holder models are included in schema binding validation. Dataset: 643 users, 24 policy roles × 64 resources × six actions, 64-level hierarchy; bulk runs use 32 users × eight roles. Each bulk operation has 20 runs; authorization has 30 warmups then 200 runs.

| Operation                    | Node 22.17.1 p50 / p95 ms | Node 24.15.0 p50 / p95 ms | Queries/run |
| ---------------------------- | ------------------------- | ------------------------- | ----------- |
| bulk mixed assignment        | 27.893 / 114.086          | 15.037 / 51.617           | 9           |
| bulk shared assignment       | 12.888 / 39.881           | 10.326 / 123.252          | 7.1         |
| bulk shared assignment retry | 5.313 / 23.751            | 4.086 / 14.455            | 6           |
| direct exact allow           | 1.447 / 8.761             | 1.14 / 7.945              | 1           |
| direct deny                  | 2.799 / 18.819            | 1.249 / 8.436             | 1           |
| wide policy deny             | 1.609 / 8.51              | 3.088 / 19.966            | 1           |
| inherited wildcard allow     | 1.99 / 16.536             | 1.515 / 7.379             | 1           |
| large malformed grant deny   | 1.526 / 6.699             | 3.376 / 17.333            | 1           |

v22.17.1: maximum sampled per-operation heap growth 15225KiB; maximum post-GC retained change 281KiB.

v24.15.0: maximum sampled per-operation heap growth 60533KiB; maximum post-GC retained change 175KiB.

Shared assignment averages 7.1 queries because the first run creates its role; repeat assignments use six. These samples include concurrent consumer/typecheck/editor activity on a shared host and have no enforced timing thresholds. Binding validation is included but this is not an isolated attribution of its overhead. Benchmark outputs are reproducible with the script and parameters above.

### Exact archive acceptance

All four clean consumers passed **10/10** checks: stable 6.1.0 and rehearsal 6.1.0-rc.1 on Node 22.17.1 and 24.15.0. Each installs the exact archive and fresh dependencies with strict peer checks, native ESM/CJS, strict NodeNext mts/cts and Bundler declarations, published 6.0.2 custom-key upgrade/rollback, all seven shared executable recipes (including real Express denial/error handling and emitted custom-user TypeScript), installed portable skill detection, manifest version and an exact regular-file allowlist. Example bytes are compared with the documentation sources. Archived README, LICENSE, SKILL.md and its detector reference must also equal the frozen source; the full manifest must match except for the isolated RC version substitution. npm/native lifecycle scripts use the tested Node executable. Consumer dependencies are real local directories, with NODE_PATH/NODE_OPTIONS removed.

| Archive                        | Compressed bytes | Unpacked bytes | SHA256                                                             |
| ------------------------------ | ---------------- | -------------- | ------------------------------------------------------------------ |
| sequelize-guard-6.1.0.tgz      | 199060           | 794113         | `f2fc46e48840c05c7b424c9a320648611cd5db7ce28cf505ec3c2d4fbdb1f9b6` |
| sequelize-guard-6.1.0-rc.1.tgz | 199066           | 794118         | `054b5e601a46025c0990f69ac9407fa4e35691b2fef12b2f9058b9cc6d596c66` |

Each archive has 19 regular files: LICENSE/README/manifest; ESM+CJS bundles/maps; two declarations; portable skill and detector reference; eight example-directory files (seven recipes and README). No source tests, databases, credentials, node_modules or build tooling are included. The RC only substitutes the version in an isolated build copy; source remains 6.1.0. These are local rehearsal archives, not published packages. Final POSTPR round1 logs and metadata are retained under `/workspace/scratch/guard-round1/`; prior evidence remains in `/workspace/scratch/guard-final/`; raw benchmark JSON is `/workspace/scratch/guard-benchmark-node{22,24}.json`.

A separate fresh production-only lock resolution of the stable archive (`npm install --package-lock-only --ignore-scripts --omit=dev`) contains 25 package entries including sequelize-guard, with four direct runtime dependencies: tslib, lodash, node-cache and Sequelize. It includes no Vite, Nx, Vitest or TypeScript compiler. Database drivers remain application dependencies. This is a registry-resolution snapshot, not a bundled-dependency count; harness installs also include Express, sqlite3, the previous release and compiler/type fixtures. Dependency alert/exposure decisions remain in the D assessment.

The final archives replace an earlier evaluation artifact whose skill text became stale while guidance corrections were landing. The retained old archive is rejected by the new source-equality assertion (`skills/sequelize-guard/SKILL.md must match the frozen release source`) before dependency installation. All four final-archive consumer runs passed after rebuilding the corrected guidance. Runtime bundles are unchanged from the benchmark SHA256 above.

POSTPR round1 (`0c24659`): rebuilt stable and RC after the incremental-holder migration recipe/JSDoc correction. All four fresh consumers again passed **10/10**. The installed `advanced.mjs` now migrates an existing Team-only installation using Device-only `addRoleHolders` options, rejects repeated Team registration, preserves prior inherited access/memberships, and isolates same-ID Device grants; final construction/down use the complete registration map. Archive/source recipe byte checks pass. Emitted ESM SHA256 is unchanged (`bffce88bbfb863a1f78dfe2f024f44c081318b09b35a74f7301d830e907f0068`), so the existing measured runtime benchmark remains applicable; no new runtime-performance claim was inferred from the documentation fix.
