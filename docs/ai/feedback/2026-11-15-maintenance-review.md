# Sequelize Guard maintenance review and repair plan

Reviewed on 15 November 2026 at commit `f30f1f1b79140060512b5774cc8b72f134f680cb`.

## Recommendation

Keep the existing library and repair it in small changes. A rewrite is unnecessary. Before another release, repair the CI command, package entry points and declarations, and authorization-cache revocation behavior. Then reconcile initialization/migrations and replace documentation examples that do not match the implementation.

The initial review added an assessment and plan only. Its evidence below describes the original revision. Implementation has since started on `pvaghela/maintenance-fixes`; see the progress section for changes and subsequent validation.

## What is here

- `packages/sequelize-guard`: Sequelize 6 authorization library, currently version 6.0.1. Prototype extensions implement users, roles, permissions, authorization and caching.
- `apps/sequelize-guard-docs`: separate Next.js/Fumadocs application.
- Nx orchestrates package scripts/builds; Vitest exercises SQLite; Vite generates the distributable and declarations.
- Applications own authentication and protection of administrative calls. A public `assignRole()` method without an internal administrator check is not itself an authentication vulnerability.

## GitHub issue and CI evidence

The only open issue found is [#13: More control over models synching](https://github.com/lotivo/sequelize-guard/issues/13), opened in 2020. It asks for awaitable synchronization with Sequelize sync options. The current constructor now exposes `guard.ready`, so the old ignored-promise complaint is partly addressed. There is still no public `guard.sync(options)` method. Cache initialization catches database errors, allowing `ready` to resolve after failure. Do not close the issue as fully fixed yet.

The latest [CI run, 20262365831](https://github.com/lotivo/sequelize-guard/actions/runs/20262365831), failed on 16 December 2025 at the reviewed commit. The preceding listed run succeeded. GitHub returned HTTP 410 for the old job logs; the surviving annotation says only `Process completed with exit code 1.` Consequently, the original failing step cannot be established from the retained logs.

There is a **confirmed present-day CI blocker** at `.github/workflows/ci-test.yml:42`: `nx print-affected --select=projects`. The installed Nx 22.1.1 immediately exits 1 because that command was removed in Nx 19. This is both locally reproduced and documented by [Nx](https://nx.dev/docs/reference/deprecated/print-affected). Replace it with `nx show projects --affected` and retain exact project-name matching. Do not label this the proven historical first failure: dependency installation or another earlier step could also have failed.

## Verification results

Local environment: macOS, Node 24.15.0, Yarn Classic 1.22.22 invoked through npm because Yarn was not installed globally. Dependency installation used the frozen existing lockfile.

| Check                                               | Observed result                                                                                              |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Frozen dependency installation                      | Passed; lockfile unchanged.                                                                                  |
| Vitest with V8 coverage                             | **90 tests passed in 9 files**; 97.31% line coverage, 90.96% branch coverage.                                |
| `nx print-affected --select=projects`               | Failed with removed-command message.                                                                         |
| Package `tsc --noEmit`                              | Failed with TS6305 project-reference/output errors.                                                          |
| Nx library build through `yarn build`               | Passed with remote cache disabled and plugin isolation disabled locally.                                     |
| Direct Vite build                                   | Passed.                                                                                                      |
| Import generated ESM in Node                        | **Failed:** named export `without` not found in CommonJS `lodash`.                                           |
| Require built package                               | **Failed:** advertised `dist/cjs/index.cjs.js` does not exist.                                               |
| Type-check a consumer of built declarations         | **Failed:** `allow` and `userCan` do not exist on exported `SequelizeGuard`.                                 |
| Package ESLint after coverage generation            | Failed on six generated coverage JavaScript files.                                                           |
| Same ESLint check excluding `coverage/**`           | Passed. This distinguishes generated-output noise from source lint errors.                                   |
| Warm authorization, remove role, check again        | Database role association gone; `userCan` and `userIsA` still true. Clearing the user cache restores denial. |
| Two guards sharing one SQLite database              | After revoking a permission through A, A denies but B still allows, even with `userCache:false` on B.        |
| User owns admin + user; requires admin              | `userHasAllRoles` returns false.                                                                             |
| Grant read + edit, remove edit                      | `permsRemoved` is empty and edit remains allowed.                                                            |
| `resetCache()` then `getCache()`                    | Cache remains empty rather than loading existing database roles.                                             |
| Construct with `sync:false` against missing tables  | Error is logged, but `ready` resolves.                                                                       |
| Real migration with timestamps, then runtime models | Fails on missing `createdAt`; migration created `created_at`. Role-user index inspection returns no indexes. |
| Yarn dependency audit                               | Nonzero exit; 239 distinct advisory records representing 213 distinct advisory URLs. See triage below.       |

Nx initially stalled under restricted worker execution. Retrying with the expected Yarn executable and appropriate local execution permissions completed. This local tooling issue is not attributed to GitHub CI. No Linux CI rerun or published npm tarball was tested.

## Release-blocking package defects

### ESM imports and missing CommonJS

`packages/sequelize-guard/vite.config.mts:70` emits only `es`, while `package.json:34-43` promises both ESM and CommonJS. Lodash is externalized at `vite.config.mts:76`, but source files use named imports that Node cannot reliably obtain from Lodash's CommonJS exports. Vitest's source transformations hide this consumer failure.

Smallest repair: keep the existing build, make Lodash imports interoperable, emit both supported formats, and use an actual `.cjs` extension for CommonJS under `type: module`. Update `main`, `module`, `exports`, generated files, and tests together. Simply adding `cjs` to the formats array does not fix the `.cjs.js` module classification or the ESM Lodash failure.

Nx's existing Vite executor copies the package manifest into the build directory; a new manifest generator is unnecessary.

### Published declarations lose the extension methods

`src/index.ts:6` imports the ambient `sequelize-guard.types.d.ts` augmentation. The generated `types/index.d.ts` does not retain that import, and the augmentation file is absent from build output. The runtime extensions exist, but consumers lose their method types.

Preserve and reference the augmentation in emitted declarations, or move it to a form the existing declaration generator emits. Keep the current public surface. Verify a consumer outside the source tree using the packed package; include TypeScript bundler and NodeNext resolution, ESM import and CommonJS require. Do not use workspace source aliases in these checks.

### Type-check configuration and misleading tests

The package tsconfig includes its source while also referencing a child config extending it. `tsc --noEmit` expects declaration outputs that were not built. Separate the library type-check target from project-reference orchestration and test configuration; do not silence TS6305 or loosen strictness.

`control.test.ts` creates its database with `seedData:false`, then several tests look up users and put every assertion inside `if (user)`. Those tests can pass without checking anything. One unreachable assertion expects `rmAssignedRoles()` to return `1`, although the implementation returns void. Create the required user fixtures and fail explicitly if setup is missing. High line coverage does not establish correct revocation, packaging or migration behavior.

## Confirmed authorization vulnerabilities

### S1 — Revoked membership survives in the default cache

**Medium severity; high confidence; locally reproduced.** Root: `packages/sequelize-guard/src/guard/Users.ts:52-85`.

`rmAssignedRoles()` removes the database association but does not evict `user_<id>`. All role and permission checks read that snapshot through `getUserRoles()`. A previously authorized user can continue using revoked access for the remaining default 60-second TTL. Larger TTLs extend this; NodeCache zero TTL is unlimited. Ordinary cache hits do not extend expiry.

Invalidate membership on successful assignment/removal and account for role deletion. Handle an in-flight old read repopulating the cache after invalidation, or use authoritative reads for authorization. Regression tests must warm `can()` and `isA()` before revocation, then require immediate denial. Existing tests read the association directly and miss this path.

`userCache:false` mitigates this particular membership snapshot. Explicit `resetUserCache()` also clears it locally. Neither solves S2. After deleting an entire role, some permission checks throw on a missing cache entry; do not assume every such path continues granting access.

### S2 — Other workers retain revoked permissions indefinitely

**Medium severity; high confidence; reproduced with two guard instances.** Root: `packages/sequelize-guard/src/utils/cache.ts:121-139`, supported by `:18-35` and `guard/Roles.ts:257-263`.

The policy cache has no expiration. It loads roles and permissions once, then updates through instance-local events. Revocation through worker A never reaches already-initialized worker B. A user who retains the role can continue using the removed permission on B indefinitely. This requires multiple serving instances or out-of-band policy writes; deployed topology was not inspected.

Prefer authoritative database permission reads for the smallest correctness-first repair. If caching remains necessary, explicitly choose the promised revocation interval, implement real refresh, and provide cross-instance invalidation for immediate guarantees. Do not add Redis or a new cache abstraction before establishing that requirement. `userCache:false` affects only membership, not the role-permission cache. `resetCache()` currently empties entries without reloading, so it is not a valid refresh workaround.

## Other correctness and integration problems

| Problem                                        | Evidence and smallest direction                                                                                                                                                                                                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| All-role checks reject extra roles             | `authorize/authorizeRoles.ts:39-44` switches comparison direction based on length. Always check required roles against owned roles; define empty-list semantics. This is a false denial, not a demonstrated privilege escalation under normal unique-role invariants.           |
| Permission removal compares serialized bundles | `guard/Roles.ts:245-255` compares resource plus JSON action array exactly. Subsets and reordered actions do not match. Define whether bundles are atomic or removals operate on action sets, document the result, and test it before changing semantics.                        |
| Cache initialization hides failure             | `utils/cache.ts:140-151` logs and swallows database errors. Reject readiness, track in-progress initialization, permit recovery, and bind listeners only once.                                                                                                                  |
| Cache reset does not reload                    | `utils/cache.ts:110-124` keeps `_cache` truthy after flushing. Repair reset/reload together with callers and tests.                                                                                                                                                             |
| Sync and migrations create different schemas   | Migration schema factories omit reference arguments and junction indexes; timestamp names differ. Test actual `migration.up`, normal CRUD, foreign keys, duplicate memberships and `down`, not just stubbed table-name order.                                                   |
| Advertised delete safeguard is unused          | `safeGuardDeletes` appears in options/defaults but `deleteRoles()` never reads it. Implement the advertised protection or explicitly remove/deprecate it; silent deletion is not the documented contract.                                                                       |
| Custom table options are ignored               | `sequelize-models/types/ModelType.ts:42-46` uses only prefix plus a fixed map. Existing database names require a migration/compatibility decision before honoring previously ignored options.                                                                                   |
| Permission grammar is undefined at edges       | `authorize/authorizePerms.ts:62-64` ignores tokens after the resource; creation accepts arbitrary resource strings. Define/validate grammar consistently. A distinct-resource bypass depends on how a consuming application constructs names; no such application was supplied. |
| Unused allow/deny-looking column               | Permission `allow` is not consulted. No public deny contract was established; clarify or remove it rather than claiming a proven deny bypass.                                                                                                                                   |
| Documentation does not describe this API       | Guides use nonexistent `guard.users`, `guard.cache`, nested authorization APIs, wrong option names and cache keys. Rewrite examples against executable public APIs. Do not implement fictional APIs merely to preserve prose.                                                   |
| Unsafe Express authentication example          | `examples/express.mdx:66` trusts `x-user-id`. Require a principal established by verified application authentication. This is instructional code, not a live docs-server bypass.                                                                                                |

A further cache-concurrency concern remains unvalidated: concurrent permission mutations construct snapshots from pre-write reads and may overwrite newer cached policy. Add a deterministic interleaving test during cache repair.

## Dependency security triage

The audit covered the entire workspace, including docs and development tools. Its aggregate counters were 12 critical, 500 high, 332 moderate and 34 low **dependency-path occurrences**, not 878 distinct exploitable vulnerabilities. Deduplication produced 239 advisory records and 213 advisory URLs; some advisories have multiple version-range records. Yarn's workspace summary does not reliably separate runtime from development exposure here.

| Area                             | Evidence                                                                                                                                                                                                                      | Action and exposure limits                                                                                                                                                                                                                                                                                                               |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Docs server                      | Next 16.0.8 and React/ReactDOM 19.2.1 are locked. [Next's Server Components DoS advisory](https://github.com/vercel/next.js/security/advisories/GHSA-mwv6-3258-q52c) explicitly covers this version and App Router endpoints. | Upgrade to a currently supported patched Next 16 release and compatible React/Fumadocs versions, refresh lockfile and rebuild/redeploy docs. 16.0.9 was the first fix for this one advisory, **not a sufficient current upgrade target**: the current audit reports later advisories too. Verify deployed version; it was not inspected. |
| Library ORM                      | Sequelize 6.37.7 is locked. [Maintainer SQL-injection advisory](https://github.com/sequelize/sequelize/security/advisories/GHSA-6457-6jrx-69cr) fixes JSON cast-key injection in 6.37.8.                                      | Raise the tested minimum and peer range coherently within Sequelize 6. The library's inspected queries do not expose arbitrary JSON cast keys; a directly exploitable first-party SQL-injection path was not established.                                                                                                                |
| Lodash                           | 4.17.21 is locked; current audit reports template code injection and pollution advisories. [Maintainer template advisory](https://github.com/lodash/lodash/security/advisories/GHSA-r5fr-rjxr-66jc) specifies 4.18.1.         | Upgrade and recheck. Registry audit metadata listed 4.18.0 while the maintainer page specifies 4.18.1; use the stricter maintained guidance. This library does not call `template`, `unset`, `omit` or `pullAt`, so these are dependency advisories, not proven library exploit paths.                                                   |
| Transitive runtime dependency    | Sequelize resolves dottie 2.0.6; [audit advisory](https://github.com/advisories/GHSA-r5mx-6wc6-7h9w) lists 2.0.7 as patched.                                                                                                  | Refresh the compatible transitive resolution and check ORM behavior. No first-party pollution exploit established.                                                                                                                                                                                                                       |
| Development tools                | Audit flags Nx, Vitest UI, Vite/Rollup and older transitive utilities. Vitest UI advisory requires the UI server to be listening.                                                                                             | Update compatible tool groups together; distinguish CI/build/UI exposure from runtime library consumers. Do not expose test UI servers to untrusted networks.                                                                                                                                                                            |
| Obsolete documentation toolchain | ESDoc and its plugins pull old Babel/marked/request-related dependencies; active docs generation uses TypeDoc.                                                                                                                | Confirm no remaining supported ESDoc use, then remove ESDoc dependencies and `.esdoc.json` rather than applying broad transitive overrides. Keep TypeDoc.                                                                                                                                                                                |

Do not run a blanket forced dependency upgrade. Preserve the lockfile, update one coherent group at a time, and repeat audit plus the consumer tests. Avoid promising zero advisories solely by counting scanner output.

## Ordered implementation plan

### 1. Restore reliable CI and package-consumer checks

**Reach:** `.github/workflows/ci-test.yml`, package build configuration/manifest, public type augmentation, package/root tsconfigs and ESLint ignores, consumer test fixtures, release workflow where it invokes these checks.

- Replace the removed affected-project command; keep lint/test/build selection behavior. Add explicit type checking once its configuration is repaired.
- Pin the expected package-manager version and align Node requirements across manifests, `.nvmrc` and README. Test the supported minimum Node line and current supported LTS rather than declaring a broader range than is exercised.
- Fix ESM interoperability, actual CommonJS output and declaration augmentation together.
- Ignore generated coverage/build artifacts in lint; retain lint coverage of real tests/configuration as appropriate.
- Pack into a temporary location and install into isolated ESM, CommonJS and TypeScript consumers. Check runtime imports, migration export and representative public methods.

**Done when:** fresh frozen install, lint, typecheck, tests, build and packed-consumer checks pass. GitHub CI must execute the library checks for a library/config/lockfile change; a docs-only change must have the intended docs validation. No publish step is needed to verify this.

### 2. Repair authorization state and meaningful tests

**Reach:** `guard/Users.ts`, `guard/Roles.ts`, `authorize/authorizeRoles.ts`, `authorize/authorizePerms.ts`, `utils/cache.ts`, `utils/userCache.ts`, prototype/type declarations only if signatures change, `authorize/users/control/misc/events` tests and their fixtures, caching/authorization guides.

- Fix S1 and S2 with explicit consistency semantics and the smallest implementation that satisfies them.
- Fix the all-role subset direction and missing/deleted-role handling.
- Make cache load/reset failures observable and prevent duplicate listener registration.
- Replace assertion-skipping fixtures. Add warmed revocation, cached empty assignment, deleted role, two-instance and deterministic concurrent-mutation cases.
- Resolve action-bundle removal and malformed-permission contracts before changing behavior.

**Done when:** revocation is enforced according to the documented guarantee, checks never grant based on invalid identity/policy state, supersets behave correctly, and tests exercise actual state transitions. Measure performance before introducing a replacement cache system.

### 3. Finish initialization and migration behavior; resolve issue #13

**Reach:** `SequelizeGuard.ts`, model setup/helpers, migration schema and up/down functions, options and public declarations, initialization tests, real database migration fixtures, README and initialization/migration examples.

- Add an awaitable `sync(options)` consistent with Sequelize sync options while retaining `ready` compatibility. Keep schema synchronization distinct from fluent `init()` (which currently builds permission statements).
- Ensure constructor readiness rejects failed sync/cache setup. Document `await guard.ready` in ordinary examples.
- Sync in dependency order; do not silently alter/drop a caller's custom user table. Make custom-model handling explicit and test it.
- Align timestamp fields, foreign keys and unique constraints between sync and migration paths. Validate custom user primary-key configuration.
- Address ignored table names and `safeGuardDeletes` with an explicit compatibility strategy. Existing databases may need a migration; do not silently rename or drop tables.

**Done when:** options propagate, failures reject, repeated sync is safe, real migration-created databases support CRUD/authorization, rollback handles custom UserModel safely, and evidence supports closing #13. Validate SQLite first, then PostgreSQL/MySQL if their support remains advertised. Additive fixes can be patch/minor releases; changed defaults or database naming need a documented breaking release.

### 4. Update dependencies, docs and release hygiene

**Reach:** workspace/package manifests and lockfile, docs application, guide/examples/migration/blog content, TypeDoc output, docs generation script, CI/release/docs-update workflows.

- Prioritize the deployed docs framework and runtime ORM updates; remove unused ESDoc tools, then update compatible development tooling groups.
- Replace invented API examples with a small tested quick start, custom user-model example, authenticated Express integration and accurate cache/migration guidance.
- Remove unsupported claims about role inheritance, durable timer-based privileges, emitted audit events and backward compatibility unless demonstrated by implementation/tests.
- Generate release docs from the released revision, detect newly generated files as well as tracked diffs, and fix the currently referenced but unset `file_count` output.
- Add explicit least-privilege CI permissions, pin third-party actions by reviewed commits, validate tag versions and pass tag text through environment variables rather than interpolating it into shell source.
- Verify npm trusted-publisher/environment settings and run package smoke checks before tagging. Configure prerelease metadata consistently with npm's `next` dist-tag.

**Done when:** current dependency advisories are triaged by reachability, docs build and examples work, and a release dry run produces exactly the artifact tested by consumers. Publishing and GitHub issue updates are separate follow-up actions.

### 5. Add guidance for AI contributors and package consumers

Follow the [AI support plan](./2026-11-15-agent-support-plan.md): repository `AGENTS.md`, one reusable integration skill, executable examples shared with docs, packaged guidance and discovery through the existing LLM documentation route. Establish the corrected authorization and initialization contracts before teaching agents to rely on them. No new AI runtime service is needed.

## Implementation progress

The CI and packaging implementation is complete locally on `pvaghela/maintenance-fixes` and is being prepared with the authorization repairs for the combined maintenance PR. No tag or npm publication is part of this work.

- Replaced `print-affected`, pinned Yarn Classic 1.22.22, and added Node 22.17.1/24.x CI coverage, explicit type checking and packed-consumer checks. Release checks run after the version is set, without rebuilding over that version.
- Fixed Lodash ESM interoperability and emitted both native ESM and `.cjs` output. Moved the existing extension-method signatures onto the class as type-only declarations; runtime prototype installation is unchanged. Bundled declarations now provide separate ESM/CommonJS entry files without unresolved relative imports.
- Removed the package's circular TypeScript project reference, retained the root solution configuration, and excluded tests/helpers from emitted declarations. Lint excludes generated coverage/build files and docs `.source` files. Small docs lint fixes retain full-page recovery links in error boundaries.
- Added explicit Nx inputs for the root consumer script, workflows and shared configuration. Root wrapper scripts are excluded from Nx target inference so affected checks do not schedule duplicate library builds in parallel.
- Added six tarball checks: native ESM and CommonJS with SQLite allow/deny assertions, strict TypeScript consumers in ESM NodeNext, CommonJS NodeNext and Bundler modes, and distributable-content assertions. The library is extracted from its real tarball; dependencies reuse the frozen workspace installation offline.

The checks first failed against the original build for ESM/CommonJS imports, missing public methods, NodeNext declaration resolution and leaked test-support declarations. Validation after repair:

| Check                         | Result                                                                                                                                                                                    |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frozen Yarn installation      | Passed; dependencies and lockfile unchanged.                                                                                                                                              |
| Node 22.17.1 and Node 24.15.0 | Both passed affected lint, build, typecheck, coverage and packed-consumer targets with CI's three-task parallelism and the build cache bypassed.                                          |
| Library tests                 | 90 passed in 9 files on both versions; 97.31% line coverage. Existing assertion-skipping cases remain assigned to phase 2.                                                                |
| Packed consumers              | All six passed on both Node versions with TypeScript 5.9.3 and `skipLibCheck: false`.                                                                                                     |
| Docs application              | Lint and production build passed on both versions, including `/llms-full.txt`.                                                                                                            |
| Affected-project selection    | Library selected for source, consumer script, workflow, shared config, root manifest, lockfile and packaged README edits; a docs-only edit selected the docs project without the library. |
| Other checks                  | Root TypeScript solution, consumer-script lint and `git diff --check` passed.                                                                                                             |

Local runs disabled Nx daemon/remote cache/plugin isolation for this execution environment and set `NODE_ENV=production` for docs builds. A run without production mode failed docs prerendering; the production-mode runs above passed. The declaration tool reports that its bundled TypeScript 5.8.2 is older than the workspace's 5.9.3, but emitted declarations passed strict consumer compilation. Dependency/tool upgrades remain phase 4. GitHub-hosted Linux execution, registry installation of a published version and publishing permissions are not verified by these local checks.

### Authorization revocation repairs

S1 and S2 are addressed by reading authoritative database state for authorization. `userCan` reads membership and permissions together, `getUserRoles` always reads membership, and the corresponding role checks use these current reads. Authorization and revocation-target reads select Sequelize's writer connection with `useMaster: true`. Deleting roles uses database rows rather than the instance's potentially incomplete role cache. All-role checks now test the required subset and treat an empty requirement as satisfied.

The old user-cache option remains accepted but no longer enables cached authorization. Cache accessors remain available for compatibility; legacy administrative snapshots and cache lifecycle behavior are not repaired in this phase. Each check now incurs a database query. Checks started after a committed revocation outside an older transaction snapshot observe it across instances; a check already reading when revocation occurs may return the earlier state, but does not store it for subsequent checks. Database failures reject rather than falling back to an allow decision.

Thirteen regression cases cover warmed membership and permissions, empty memberships followed by grants, deleted roles, separate Sequelize connections with caching configured on/off, direct association writes, delayed membership reads and delayed grant writes, database errors, required-role subsets and writer routing. The initial eleven cases all failed against the original authorization implementation; two subsequent replica-routing cases also failed before their fixes. Authorization/user fixture lookups now reject absent users, and the unseeded control suite explicitly creates its users. Both packed runtime consumers also verify revocation.

No schema migration is introduced. Rollback of these authorization changes would restore the known stale-access behavior; preserve database-backed authorization or restrict affected operations if an operational rollback becomes necessary. Actual replicated PostgreSQL/MySQL deployments and throughput are not validated by SQLite and query-routing tests. Action-bundle subtraction, readiness/cache lifecycle and migration work remain in the next phases.

Final local validation passed on Node 22.17.1 and 24.15.0: 103 tests in 10 files, six packed-consumer checks, strict type checking, lint, library build and docs production build. The full affected targets ran with three-task parallelism and the build cache bypassed. Line coverage is 96.08%; removing unreachable assertions makes the suite more meaningful despite the lower percentage. The lockfile and installed dependency versions are unchanged in this PR.

### GitHub sequencing

Reviewed [Dependabot PR #45](https://github.com/lotivo/sequelize-guard/pull/45) at `1b82bdac9468db70600d010715778966cb7da64a`. It changes the root/docs manifests and lockfile, including Nx 22.7.10, Vite 7.3.7, Vitest 4.1.11 and Next 16.4.1. Its [CI run](https://github.com/lotivo/sequelize-guard/actions/runs/43764653326) fails during Yarn installation with `could not find a copy of vite to link`; no tests or build execute. Coverage/UI remain at Vitest 4.0.9 and the Nx companion packages remain pinned to 22.1.1. These need alignment and fresh installation checks, not an immediate merge. There were no review threads or submitted reviews when inspected.

The agreed order is to validate and merge the combined maintenance PR first, then rebase #45 onto the updated `master`, fix its dependency/install failures on its own branch, and check Codex review comments and CI. [Issue #13](https://github.com/lotivo/sequelize-guard/issues/13) remains open for awaitable schema synchronization with Sequelize options; these cache repairs do not complete that request.

AI support is planned in the linked document; contributor instructions and the consumer skill have not been implemented yet.

### Dependabot repair

[PR #46](https://github.com/lotivo/sequelize-guard/pull/46) merged as `a9a3000` after both CI versions and the Vercel preview passed; the subsequent `master` CI passed too. PR #45 was rebased onto that commit. Nx and its plugins now share 22.7.10, Vitest/UI/coverage share exact 4.1.11 versions, and the Next ESLint configuration matches Next 16.4.1. Next regenerated its tracked environment declarations during the build.

Aligning companion versions alone reproduced the Yarn linking failure. Deduplicating Vite to 7.3.7, which satisfies both the build and Vitest dependency ranges, fixed it without a dependency override. Yarn regenerated the lockfile and removed the unused Vite 8 dependency tree. A clean frozen installation with all workspace `node_modules` directories moved aside passed on Node 22.17.1. Node 22.17.1 and 24.15.0 then passed affected lint, library/docs builds, type checking, 103 tests and six packed-consumer checks with the Nx build cache bypassed. No Codex review threads were present on either PR when checked. Hosted checks on the repaired PR remain the final gate before any separate merge decision.

### Issue #13: awaitable synchronization

Implemented locally on `pvaghela/awaitable-guard-sync`, based on the merged dependency fixes. The issue remains valid: `ready` partly addressed the old ignored-promise report, but did not provide explicit synchronization options or propagate cache-loading errors. No issue comment or closure has been submitted.

- Added `await guard.sync(options)`, using Sequelize's `SyncOptions` and resolving to the guard after its models and cache finish loading. Calls are serialized with automatic startup, tables are created in dependency order, and force synchronization drops junction tables first. The database-name `match` check runs before any schema changes. A supplied `UserModel` is included; unrelated models are excluded.
- Default construction still starts synchronization through `ready`. With `sync: false`, construction and `ready` now do no database work. Callers must await explicit synchronization or prepare tables with migrations. `init()` remains the fluent permission builder.
- Cache initialization now shares a pending load, propagates errors, permits retry, reads the writer connection and reloads after reset/sync. Resets supersede older in-flight snapshots; event listeners remain attached once. Administrative snapshots may still be stale across workers or concurrent policy writes and are not authorization inputs.
- Added eleven SQLite regression cases for deferred startup, forwarded options, unrelated models, schema/cache failures, retries, force synchronization, database-name protection, queued startup and concurrent/reset cache loads. The initial ten cases failed against the original implementation. Packed ESM/CommonJS and strict TypeScript consumers now exercise `sync()` too.

Validation passed on Node 22.17.1 and 24.15.0: 114 tests in 11 files, six packed-consumer checks, type checking, lint, library build and docs build. The final startup/API documentation changes were included in the Node 24 docs build. Source mapping found no new placement or dependency-cycle issues; automated layer checking is unavailable because the repository has no architecture declaration. Changed imports were reviewed against the existing ORM wrapper structure.

This is a high-risk lifecycle/API change, tested with SQLite rather than PostgreSQL/MySQL. `force` and `alter` retain Sequelize's destructive semantics, including for a supplied user model; synchronization belongs before request handling and is not atomic with concurrent application operations. There is no new automatic data migration. To roll back, revert this branch's changes and remove new `sync()` calls from applications; reverting cannot restore data explicitly dropped or altered by a caller. These changes are being submitted for PR review; merging, publishing and closing the issue are separate steps. The issue closing message must be reviewed before posting.

### Independent PR review follow-up (2026-11-16)

Separate reviewers examined PR #47 (dependencies) and PR #48 (synchronization). PR #47's Sequelize peer range still admitted older caller-provided ORM instances, so it now requires `^6.37.8`, matching the runtime dependency, and the README states the same minimum. Its description also records the Rollup update omitted from Dependabot's summary. Older development-tool Lodash copies remain outside this update's scope.

PR #48's review reproduced a destructive schema-routing mismatch: per-call schema options affected table creation differently from model-bound drop/index queries. Per-call PostgreSQL search paths likewise affected synchronization without affecting subsequent authorization reads. The fix validates all models' public `getTableName()` schemas before any DDL and rejects per-call `searchPath`; configure schema routing on Sequelize before constructing the guard. Seven added regressions cover normal/force/alter rejection, fresh databases, mismatched custom users, matching bound schemas with force and authorization, and PostgreSQL preflight without opening a connection. All 18 synchronization regressions pass. The reviewer rechecked the fix and found no remaining blocker; live PostgreSQL/MySQL integration remains untested.

## Scope, limitations and what to skip

The source review covered tracked first-party implementation, tests, configuration, docs app and documentation, with independent security and architecture reviews. The lockfile received a registry audit and targeted version inspection, not line-by-line dependency-source review. No credible embedded source credential was found; Git history and deployed secrets were not inspected. No first-party raw SQL injection, request-driven arbitrary file access or remotely supplied MDX execution was established.

Runtime validation used local SQLite. PostgreSQL/MySQL, production deployments, branch protections, npm trust configuration, the previously published tarball, a full docs production build and live exploit testing were not checked. Concurrency guarantees need the deterministic tests listed above. Findings are not a claim that any deployed system has been compromised.

Skip a rewrite, Sequelize 7 migration, new authorization features, a distributed cache dependency, and large structural refactoring until these repairs pass. The release risk is currently incorrect package consumption and stale authorization after revocation, not a lack of abstractions.
