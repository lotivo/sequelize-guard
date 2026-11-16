# Cloud Codex handoff — 16 November 2026

> Historical handoff/plan. Cloud continuation preserved this history, completed the implementation on the maintainer-renamed `fix/pre-release-hardening` branch, and records current state in [final acceptance](./2026-11-16-final-acceptance.md). The old branch name and failing-test counts below describe the transfer checkpoint.

## Start here

Continue the pre-release improvement work in `lotivo/sequelize-guard` on **`pvaghela/release-cloud-handoff`**, targeting `master`. The maintainer paused local implementation to sleep and requested this separate remote branch with all existing work. The local goal remains paused; this document transfers context for a separately started cloud task. Do not depend on the original chat, temporary worktrees or local services.

The branch includes the original integration history through `4543e7e`, three completed H commits and two explicitly unfinished C/F commits. Implementation HEAD at handoff is **`593038b`**; a following documentation commit records this status. The original `pvaghela/release-improvements` branch was preserved. No PR, merge, tag, release or production migration is part of this handoff.

Read the [52-item checklist](./2026-11-16-release-readiness-checklist.md), [execution plan](./2026-11-16-release-execution-plan.md), [API contract report](./2026-11-16-api-lifecycle-handoff.md), [implementation review](./2026-11-16-implementation-review.md), [foundation review](./2026-11-16-foundation-review.md), [dependency assessment](./2026-11-16-dependency-assessment.md) and [release workflow assessment](./2026-11-16-release-workflow-assessment.md). Review reports are dated snapshots, not proof that subsequent fixes are complete.

The requested end state is one branch containing all work, then one PR after implementation, independent review and checks. Use one GPT-6.1 Sol medium subagent per category where available, with an orchestrator integrating focused commits. Independent categories can run in parallel; public documentation comes after implementation contracts settle, and AI support after documentation/examples. Do not mark a checklist item complete solely because code exists or a limitation is documented.

## Current verification: not release-ready

The assembled implementation at `593038b` was checked on Node **22.17.1**, Yarn **1.22.22**, with Nx caching disabled:

- Library lint: passed.
- Library TypeScript check: passed.
- SQLite: **223 passed, 3 failed**, across 17 files (15 passing, 2 failing).
- `init.test.ts`: `Migrations > should run up migration` and `should run up migration with options` fail with `Cannot read properties of undefined (reading 'attributesToSQL')` in `migrations/guard-table-ddl.ts`, reached through the new provisioning path. Inspect the mocked query interface and production DDL expectations; do not weaken real migration coverage to silence the failure.
- `sync.test.ts`: `accepts a schema already bound to every guard model` fails with `SQLITE_ERROR: near ".": syntax error` for `CREATE INDEX guard_roles_parent_id ON tenant.guard_roles (parent_id)` (identifiers quoted separately in the actual SQL). Preserve SQLite's physical table-name behavior while fixing index creation.

No final build, coverage, fresh consumer, Node 24, PostgreSQL/MySQL/replica, docs or hosted CI run was performed after collecting the WIP commits. Earlier component checks passed, but apply to earlier code: C reported 215 tests plus seven package checks on both Node lines; H reported eight fresh-consumer checks for stable and prerelease archives on both Node lines; F reported SQLite and live dialect/replication checks before its unfinished follow-up. These are useful baselines, not final acceptance.

## Work already collected

| Category | Progress | Still needed |
| --- | --- | --- |
| A — authorization | Exact-token revocation, canonical action bundles, grammar validation, writer-backed reads, atomic mutations, caller savepoints and commit-aware events | Final combined review and contract documentation |
| B — schema/migrations | Model/migration parity, custom identities, distinct-prefix offline upgrade, conservative rollback, exclusive MySQL creation, external-reference preflight, real database/replica tests | Receipt lifecycle and live-binding safety; rerun dialect matrix |
| C — API/lifecycle | One guard per connection, collision preflight, generic custom users, honest return types, builder lifecycle, shared options, no role-cache timer | Finish WIP schema immutability/binding protection; compatibility prose via E |
| D — dependencies | Removed ESDoc, updated toolchain/dependency paths and recorded residual exposures | D4/D5 security guidance and authenticated examples via E |
| F — features | Bulk assignments, single-parent inheritance, registered model role holders, active-principal checks | Finish archived-link restoration, binding locks and receipt regressions |
| H — acceptance/performance | Fresh npm consumers of exact archive, native imports and strict declarations, large-policy tests, bounded indexed grant projection, benchmark script | Final contract matrix, updated benchmarks, stable/RC archive acceptance |
| I — release | Candidate 6.1.0, pinned minimal-permission workflows, exact archive promotion, Node 22/24 consumers, OIDC publishing job, tag validation, docs workflow | Final integrated rehearsals and changelog/upgrade docs |
| E — human documentation | Not started | Rewrite guides/README/examples, security/upgrade/compatibility notes, changelog, generated API docs |
| G — AI support | Not started | Root AGENTS.md, portable packaged skill, discovery files, actual agent evaluations |

Newly collected commits: `92426c4` fresh consumers; `134388e` bounded projection/large policies/benchmark; `90686e8` indexed grant lookup; **`b6a1b14` WIP options immutability**; **`593038b` WIP receipt lifecycle, binding and archived grants**. The only cherry-pick conflict was at the end of `bulk-assignments.test.ts`; both H's large/empty-input tests and F's archived-membership regression were retained.

## Next steps, in order

1. **Repair the three recorded test failures**, preserving real schema behavior and meaningful mocks. Re-run targeted tests, then the full library suite.
2. **Finish and independently review ownership safety (B/C/F).**
   - A failed sync previously left a complete receipt claiming tables never created, allowing later adoption/drop of an unrelated table at those names. The WIP uses exclusive provisioning and writes the complete receipt only after owned tables/indexes and upgrade copy succeed. Prove failure/retry safety, concurrent creation and MySQL partial cleanup; never leave a complete receipt claiming uncreated tables.
   - WIP freezes schema-defining options and the `guard.options` reference while retaining intentional policy/debug/cache changes. Caller-owned Sequelize/model objects must remain unfrozen. Live `sequelize.options.define`/schema changes or reinitialized application model metadata can still drift from captured bindings: reject that drift before DDL and linked authorization/mutations, or derive checked targets from exact bound models. Add regressions proving no destructive operation occurs first.
   - Model-form permission additions and permission removal previously bypassed binding checks. WIP adds locks; review every relevant entry point and lock ordering, including caller transactions.
   - Published 6.0.2 can leave soft-deleted membership/permission junction rows. Explicit reassign/regrant must reactivate them without uniqueness failures, count only new active memberships, and respect transaction/event semantics. The WIP membership regression exists; review permission restoration and add missing regressions.
3. **Finish H acceptance.** Assemble a public-contract coverage matrix; rerun large/malformed/deep-policy tests, fresh installs and benchmarks after fixes. Keep exact case-sensitive grant checks and full lineage validation despite SQL projection. Preserve bounded writer queries. Record artifact contents/size and measured limits honestly.
4. **Write E documentation last.** Replace invented or nested APIs in guides, landing pages, blogs and README. Use shared executable recipes tested against the tarball. Never teach authentication via an untrusted `x-user-id`: test unauthenticated/forged identity and admin denial. Document initialization, production migrations, offline upgrade/rollback, compatibility, limits and private reporting. Add root `CHANGELOG.md` for 6.1.0 (required by release publication). Regenerate TypeDoc and validate routes/links. Include D4/D5, C6 and I6 handoffs.
5. **Implement G AI support after examples settle.** Add root `AGENTS.md`, portable `skills/sequelize-guard/SKILL.md` and minimal references, packaged exact paths, `/llms.txt` discovery and validation of existing `/llms-full.txt`. Extend the archive allowlist deliberately. Evaluate independent agents using an existing app, a custom user model and revoked access; Markdown lint alone is insufficient.
6. **Run final acceptance and independent review.** Node 22/24; SQLite/PostgreSQL 17/MySQL 8.4; physical standby; source/types/build/coverage; stable and prerelease fresh tarball consumers; release metadata/tamper checks; docs and skills. Retest fixes found by review. Update all 52 checklist items with actual evidence or obtain explicit scope decisions.
7. **Prepare one PR** against `master` with final behavior, compatibility changes, evidence and remaining external checks. Do not merge or publish without later authorization.

## Contracts to preserve

- Version **6.1.0**, not 7.0.0. The maintainer keeps the package major aligned with Sequelize major; 6.0.2 already exists and cannot be republished. Explain changed contracts despite the selected minor version.
- One parent per role; children inherit permissions. Role checks and reported role lists stay direct membership. Allow-only semantics; deprecate the unused allow field without inventing deny rules.
- Registered application models hold roles through separate typed junctions with real foreign keys. Permissions stay on roles; identical IDs in different models cannot share grants. Soft-deleted users/holders lose access.
- `sync:false` and awaiting `ready` perform zero database work. Supplied `UserModel` receives explicit `guard.sync()` options, including `force`/`alter`, per the retained contract. Registered holder application models are never synced/dropped. Static migrations never own the supplied user model.
- Explicit offline upgrade targets a distinct prefix and preserves original data/IDs. Reject noncanonical legacy role names/collisions before target DDL; remediation must preserve IDs and review memberships. Previously inert parent pointers require `inheritExistingParents:true` plus graph validation.
- Ownership compares exact physical identities: PostgreSQL default/public qualification normalized, SQLite ASCII-only case folding (Unicode names remain distinct), MySQL exact spelling. Do not substitute the conservative lowercase collision key for ownership identity.
- Schema rollback rejects external application references. MySQL incoming-FK preflight requires visibility of referencing database metadata and quiescent DDL.
- Authorization uses current writer-backed state, never cached policy. Malformed permission checks deny, malformed stored grants are ignored, database failures reject. Exact case-sensitive tokens; `*` only as a whole token; no whitespace/NUL/lone surrogates.
- Caller-owned transactions use operation savepoints and suppress built-in events. Guard-owned operations emit only after successful commit. Events are not durable audit records.
- One guard per Sequelize instance lifetime; reject collisions before side effects. Preserve unrelated application model registry entries. Constructor inference retains required custom-user attributes; `makeUser()` cannot supply mandatory fields, so use the configured model's `create(values)`.
- `createPerms`/`createPermsBulk` default to models; `json:true` gives plain data. `makeRoles` with omitted/undefined options gives plain data, explicit `{}` or `json:false` gives models. `user.roles()` gives active direct role models; guard role-list methods give plain data.
- Completed builder statements are consumed even on persistence failure; incomplete statements remain editable. Manual user caches must be closed by callers; the package never closes application Sequelize connections.

## Reproduction and cloud setup

Use Node 22.17.1 and 24.15.0 with Yarn 1.22.22. Install development dependencies before setting `NODE_ENV=production`. The repository CI workflows are the authoritative service setup; cloud cannot reuse the stopped local Mac containers. Tests need isolated disposable databases, never production credentials.

```sh
corepack yarn install --frozen-lockfile
NODE_ENV=production NX_DAEMON=false NX_NO_CLOUD=true NX_ISOLATE_PLUGINS=false \
  corepack yarn nx run-many -p sequelize-guard \
  -t lint,typecheck,build,test:coverage,test:package \
  --parallel=1 --skip-nx-cache --output-style=static
node --test scripts/release-metadata.test.mjs
corepack yarn workspace sequelize-guard-docs lint
corepack yarn workspace sequelize-guard-docs build
```

If Corepack is unavailable, the local diagnostic used `npm exec --yes --package=node@22.17.1 --package=yarn@1.22.22 -- yarn` in place of `corepack yarn`, and targets `lint,typecheck,test`. Fresh consumer checks require registry access and install the exact tarball in a clean temporary directory without workspace symlink assistance. The legacy published fixture has a narrowly scoped Lodash interop bridge; candidate import checks remain native.

```sh
SEQUELIZE_GUARD_TEST_DATABASE_URL='<isolated database URL>' \
  ./node_modules/.bin/vitest run \
  --config packages/sequelize-guard/vitest.dialects.config.mts \
  dialect.integration.ts holder-dialects.integration.ts
bash scripts/test-guard-replication.sh
# After building the library:
node --expose-gc scripts/benchmark-authorization.mjs
# For an already built release archive:
RELEASE_TARBALL='/absolute/path/to/archive.tgz' RELEASE_VERSION=6.1.0 \
  node --test scripts/test-package.mjs
```

The replication harness defaults to Docker and supports `CONTAINER_RUNTIME`. Follow the workflow for stable/prerelease archive generation and digest checks. Performance results already measured by H are preliminary local baselines, not final release claims.

The maintainer confirmed npm trusted publishing is configured for repository `lotivo/sequelize-guard`, workflow `release.yml`, environment `npm-publish`; local npm access did not independently inspect it. Do not change or exercise publication settings during continuation. Private vulnerability reporting is enabled at <https://github.com/lotivo/sequelize-guard/security/advisories/new>. The dependency assessment retains the minimatch build-time and Sequelize UUID exposure analysis; do not apply unreviewed major-version overrides.
