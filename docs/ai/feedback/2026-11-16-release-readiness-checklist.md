# Sequelize Guard pre-release improvement checklist

Prepared on 16 November 2026 against merged `master` at `95d94a1`.

Cloud continuation now targets `fix/pre-release-hardening` after the maintainer requested a clearer PR branch name. [Final per-item evidence](./2026-11-16-final-acceptance.md) records actual validation. Checked items have local implementation/verification evidence; I3 retains a private publishing-configuration limitation; hosted CI and the final two-round PR review have passed. No publication is authorized.

This is the consolidated list of work to consider before the next release, without excluding large changes. It includes confirmed defects, verification gaps, the original feature roadmap, documentation, AI support and release operations. It is a plan, not a claim that the unchecked work is implemented or that every investigation will find a defect.

Sources: [original TODO](../../../TODO.md), [maintenance review](./2026-11-15-maintenance-review.md), [AI support plan](./2026-11-15-agent-support-plan.md), current implementation and workflows. The maintenance review retains historical findings; use the completed baseline below to avoid repeating finished repairs.

## Completed baseline — preserve these guarantees

- [x] Repair CI, frozen Yarn installation and supported Node 22/24 checks.
- [x] Build native ESM/CommonJS artifacts and usable TypeScript declarations; exercise six packed-consumer checks.
- [x] Read authorization from the writer database; fix revoked memberships, cross-instance permission changes and required-role subset checks.
- [x] Add awaitable `sync(options)`, observable initialization errors, retries and shared cache initialization/reset behavior.
- [x] Reject unsafe schema overrides and per-call search-path changes before synchronization touches the database.
- [x] Update dependency groups, including runtime Lodash and Sequelize; require the patched Sequelize peer version.
- [x] Merge independently reviewed PRs #47 and #48; verify latest `master` CI passes.
- [x] Post the approved explanation and close issue #13 as completed.

The merged suite contains 121 tests and six packed-consumer checks. No release containing these changes has been published as part of this work.

## How to use this list

Each item has a stable ID and completion evidence. “Confirmed” means supported by the source review or an existing reproduction. “Verify” means a test/design gap, not a newly established vulnerability. “Feature” means requested roadmap work, not an existing supported capability.

Implement the correctness work before features that depend on it. The large roadmap features are included in section F rather than discarded because of size. Before coding them, settle their semantics and database migration strategy. Any item removed from the intended release must have an explicit scope decision; do not silently treat an unchecked item as completed.

## A. Authorization and policy correctness

- [x] **A1 — Remove individual actions from permission bundles. Confirmed.** Removing `edit` from a grant of `['read', 'edit']` must remove that access while retaining `read`. Define action-set semantics for reordered/duplicate actions, repeated removal, missing roles and wildcard grants. Do not modify a permission shared by unrelated roles. **Done:** regression tests prove the resulting authorization and returned removal result for each case.

- [x] **A2 — Define and validate the permission grammar. Confirmed ambiguity.** Creation and checks must agree on action/resource syntax, whitespace, case, empty values, extra tokens and wildcard placement. The current parser ignores tokens after the resource. Choose explicit errors or denials for invalid input and document the contract; never accidentally authorize a different resource. **Done:** one coherent validation contract covers single/bulk creation and checks, including malformed persisted action JSON.

- [x] **A3 — Canonicalize policy identity consistently. Verify.** Review role normalization, generated permission names and serialized action arrays. Equivalent action sets should not create different grants solely because of order; caller-supplied names must not silently reuse an incompatible action/resource definition. **Done:** tests cover case, duplicate names, reordered arrays, empty lists and idempotent repeated calls.

- [x] **A4 — Make mutations correct under concurrency. Verify.** Exercise simultaneous grants, removals, role creation and deletion from separate connections. Choose transaction boundaries and uniqueness constraints so a read-then-write race cannot silently restore removed actions, lose unrelated updates or leave half-completed policy changes. **Done:** deterministic interleaving and rollback tests validate the documented outcomes.

- [x] **A5 — Implement the advertised deletion safeguard. Confirmed.** `safeGuardDeletes` is exposed but unused. Define protected associations, rejection behavior and the meaning of opting out; apply the contract consistently to affected deletion operations. **Done:** associated-data and unassociated-data cases pass with the option on/off, with no undocumented cascade behavior.

- [x] **A6 — Resolve the unused allow/deny-looking field. Confirmed ambiguity.** The stored `allow` value is not part of authorization evaluation. Decide whether to reserve/deprecate it or introduce explicit deny semantics. If deny is introduced, specify precedence across roles, wildcards and inheritance before implementing it. **Done:** schema, types, documentation and tests tell the same story; do not imply existing deny enforcement.

- [x] **A7 — Make administrative policy reads trustworthy. Verify.** `getRole()`, `allRoles()` and creation helpers still use local snapshots that can become stale after another worker writes. Decide which operations require database reads and whether any API explicitly returns a snapshot. **Done:** cross-instance tests cover external create/delete/update followed by administrative reads and writes; authorization never returns to stale-cache decisions.

- [x] **A8 — Specify transaction and failure behavior. Verify.** Document how callers use policy changes inside transactions, when events become observable, and what happens on database failure or rollback. Add transaction options where required by the chosen contract rather than presenting multi-step writes as atomic today. **Done:** rollback leaves no partial policy, event behavior is tested, and applications can distinguish denial from infrastructure failure.

## B. Database schema, migrations and existing installations

- [x] **B1 — Align migrations with model synchronization. Confirmed.** Reconcile `created_at`/`createdAt`, `updated_at`/`updatedAt`, paranoid deletion fields, nullability and defaults. Choose a compatibility strategy for existing databases rather than simply renaming fields. **Done:** both creation paths support the same CRUD and authorization scenarios for every supported timestamp/paranoid combination.

- [x] **B2 — Add missing migration relationships and indexes. Confirmed.** Migration schema factories currently omit reference arguments and junction indexes. Specify foreign keys, cascade/restrict behavior, composite membership uniqueness and policy lookup indexes. **Done:** tests inspect real database constraints, reject duplicate/orphan associations and verify deletion behavior.

- [x] **B3 — Support custom user identities deliberately. Verify.** Test supplied models with required application fields, non-`id` primary-key names, UUID/string keys and schemas. The junction currently declares an integer user key while `userPk` can name a different column. Derive a compatible key definition or reject unsupported configurations before DDL. **Done:** supported identities work through migrations, assignment, revocation and authorization; unsupported ones fail clearly without changing tables.

- [x] **B4 — Honor custom table names without breaking existing data. Confirmed.** Public table options are ignored by the current prefix-plus-fixed-name helper. Define which names apply to base/junction tables and how previously ignored settings transition. **Done:** all references and indexes use the resolved names, with explicit upgrade guidance and no silent creation of a parallel empty policy database.

- [x] **B5 — Verify migration rollback and failure recovery. Verify.** Exercise real `up`/`down`, partially completed migrations, retries and databases containing custom users/application tables. **Done:** rollback drops only owned tables in dependency order and preserves application data; migration failure recovery is documented and tested.

- [x] **B6 — Provide an upgrade path for published schemas. Verify.** Test an existing supported release's database containing users, roles, permissions and memberships. Apply the planned schema changes without force-syncing. **Done:** access decisions and ownership are preserved, migration/backfill requirements are explicit, and a backup/rollback procedure exists for destructive changes.

- [x] **B7 — Run PostgreSQL and MySQL integration suites. Verification gap.** Cover real migrations, custom users, schemas/search paths where applicable, foreign keys, synchronization failure, transactions and revocation. Add database-service CI jobs for the dialects the package promises. **Done:** the advertised dialect matrix passes on reproducible environments, not just SQLite or query spies.

- [x] **B8 — Verify replica and consistency behavior on a real database. Verification gap.** Confirm that authorization and revocation-target reads reach the writer and that older transactions/in-flight checks follow the documented limits. **Done:** a replication integration test or recorded reproducible exercise validates routing and committed revocation; do not promise atomicity with the application's subsequent operation.

## C. Public API, types and lifecycle

- [x] **C1 — Audit every exported option against behavior. Verify.** Review prefixes/table names, primary keys, timestamps, paranoid mode, cache options, debug output, supplied users and deletion safeguards. **Done:** each supported option has a behavioral test; misleading/unsupported options are implemented, rejected or explicitly deprecated.

- [x] **C2 — Align declaration signatures with runtime results. Verify.** Check extension methods, optional user helpers, JSON-versus-model returns, null results and bulk-operation return values. **Done:** strict consumer fixtures cover positive and negative type cases in both module formats; runtime results agree with the declarations.

- [x] **C3 — Define model-extension ownership and repeat construction. Verify.** Check behavior when a supplied user model already has methods with the same names, when two guards share a Sequelize instance/model, and when separate connections are used. **Done:** supported reuse works without accidentally routing one guard through another; unsupported collisions fail explicitly and application methods are not silently corrupted.

- [x] **C4 — Review fluent-builder and event contracts. Verify.** Test builder reuse, invalid/incomplete statements, failed commits, event payloads and unsubscribe behavior. **Done:** errors are observable, event delivery matches committed operations, and public documentation makes no unsupported audit-log guarantee.

- [x] **C5 — Check resource and lifecycle ownership. Verify.** Repeated initialization/reset must not accumulate listeners or timers. The package must not close caller-owned Sequelize connections. **Done:** lifecycle tests and a repeated-use check show bounded resources and preserve application connection ownership.

- [x] **C6 — Publish an explicit compatibility policy. Required decision.** State supported Node lines, Sequelize range, dialects, module formats and TypeScript resolution modes. Reconcile `.nvmrc`, manifests, CI and docs; review behavior changes before selecting a version bump. **Done:** no unsupported “99% backward compatible” promise, and an upgrade guide names all changed contracts.

## D. Security and dependency maintenance

- [x] **D1 — Remove the unused ESDoc toolchain. Confirmed candidate.** Confirm no supported command still depends on ESDoc, then remove its packages/configuration while retaining TypeDoc. **Done:** documentation generation still works and obsolete dependency paths disappear from a fresh audit.

- [x] **D2 — Triage every remaining dependency alert by exposure. Verify.** Refresh the audit and distinguish published runtime dependencies, deployed docs, build/CI tools and optional development servers. The last GitHub snapshot contained 47 alerts; this is a dated signal, not 47 proven exploitable library bugs. **Done:** each remaining alert has an upgrade/removal decision or a documented exposure assessment; patched direct dependencies do not hide old transitive copies.

- [x] **D3 — Keep dependency families aligned and upgrades reproducible. Maintain.** Update Nx/plugins, Vitest/UI/coverage and framework companions together, with compatible lockfile resolutions. **Done:** clean frozen installs and full consumer checks pass on the declared Node matrix; no blanket overrides mask incompatible dependencies.

- [x] **D4 — Correct the authentication boundary in examples. Confirmed.** Remove the pattern that treats an arbitrary `x-user-id` header as authentication. Show verified application identity, protected administrative endpoints, and denial/error handling. **Done:** example tests reject forged identity, unauthenticated access and unauthorized permission administration.

- [x] **D5 — Document the security contract and reporting process. Improvement.** Explain application-owned authentication, administrative authorization, wildcard privileges, database consistency limits and supported security versions. Add a clear private vulnerability-reporting route. **Done:** guidance matches tests and does not confuse events with durable auditing or timers with reliable permission expiry.

## E. Documentation that runs against the real package

- [x] **E1 — Replace nonexistent APIs throughout the docs. Confirmed.** Audit guides, landing pages, examples, migration guides and blogs for `guard.users`, `guard.roles`, `guard.permissions`, nested authorization/cache APIs and invented options. **Done:** supported examples use actual exports; obsolete examples are corrected or clearly archived by version.

- [x] **E2 — Share executable examples between docs and consumer tests. Improvement.** Cover automatic/manual initialization, grant/assign/check/revoke, custom users, migrations, ESM/CommonJS and strict TypeScript. **Done:** examples execute against the packed artifact, with positive, negative and failure assertions; prose does not maintain divergent code copies.

- [x] **E3 — Separate authentication, authorization and schema setup in the guides. Improvement.** Explain `ready`, explicit `sync()`, migration ownership and fluent `init()` with accurate production startup recipes. **Done:** a new user can follow the quick start and migration setup without force-syncing an existing application database.

- [x] **E4 — Remove unsupported feature and compatibility claims. Confirmed.** Reconcile inheritance, automatic auditing, durable temporary privileges, cache guarantees and backward compatibility statements. **Done:** every claimed capability has implementation and tests, or is explicitly described as planned.

- [x] **E5 — Generate API documentation from the released revision. Confirmed workflow gap.** Stop deriving release docs from whichever `master`/latest tag happens to exist later. Detect added files as well as modified files, populate/remove `file_count`, and enable the pinned package manager. **Done:** a dry run proves generated docs and displayed version correspond to the exact release commit.

- [x] **E6 — Repair discovery and navigation. Verify.** Check README links, docs routes, migration links, API links and package metadata. **Done:** a link/route check passes, release/version information is consistent, and users can find security limits and upgrade instructions.

## F. Original roadmap features — included regardless of size

- [x] **F1 — Bulk assignment across multiple users. Feature.** Add the original requested capability to assign a role set to several users and express different user/role assignments in one operation. Choose an unambiguous API before committing to overloads; define deduplication, invalid users, return values, atomicity and partial failures. **Done:** types, examples and tests cover mixed assignments, repeat calls, rollback, authorization afterward and query growth with batch size.

- [x] **F2 — Child roles and inherited permissions. Feature.** Existing parent fields do not by themselves provide a complete inheritance contract. Decide inheritance direction, whether role checks include ancestors, single versus multiple parents, wildcard/deny precedence, and revocation behavior. Prevent self-links and cycles; define deletion/reparenting and migration behavior. **Done:** multi-level grants and revocations work across instances with cycle, orphan, concurrent-edit and performance tests; documentation advertises only the implemented semantics.

- [x] **F3 — Polymorphic role holders. Feature.** Design roles for registered models beyond users, preserving identity as model type plus primary key rather than a bare ID. Define supported key types, associations, cleanup and how an application's own authorization protects changes to each holder type. Decide separately whether direct polymorphic permissions are needed. **Done:** different models with the same numeric ID cannot inherit each other's access, migrations preserve existing user memberships, and typed examples/tests cover both user and non-user holders.

These features require design and migration review before implementation. Their size is not a reason to omit them from this list. Their final contracts must be settled before agent guidance or documentation teaches applications to use them.

## G. AI contributor and consumer support

- [x] **G1 — Add root `AGENTS.md`. Planned.** Describe repository structure, supported tools, validation commands, database/security boundaries and rules for keeping implementation, declarations, examples and packaging aligned. **Done:** commands work from the stated directories and guidance distinguishes generated files from editable sources.

- [x] **G2 — Add one portable package-integration skill. Planned.** Implement the existing AI support plan with `skills/sequelize-guard/SKILL.md` and only the references it needs. Teach version detection, verified identity, schema ownership, public APIs and allow/deny/revocation tests. **Done:** skill metadata/references validate and all recipes are executable.

- [x] **G3 — Ship and expose agent guidance. Planned.** Include the consumer skill in the npm artifact and link it from README/docs. Reuse `/llms-full.txt`; add a small `/llms.txt` index after fixing the underlying docs. **Done:** packed-content and route checks pass, links are version-aware, and installation instructions do not claim automatic discovery by every agent tool.

- [x] **G4 — Evaluate realistic agent tasks. Planned.** Try integrating an existing app, a custom user model and diagnosing revoked access. **Done:** record the agent/tool version and results; generated code preserves authentication, awaits initialization, uses real APIs and passes denial tests. Do not equate Markdown validation with agent-code quality.

## H. Testing, performance and package quality

- [x] **H1 — Build a public-contract regression matrix. Improvement.** Map exported operations to normal, empty, invalid, repeated, concurrent and failure cases. Remove any remaining conditional assertions that silently skip verification. **Done:** each supported behavior has meaningful coverage; percentages alone are not acceptance evidence.

- [x] **H2 — Add real consumer installation checks. Verification gap.** Existing tarball checks reuse locked workspace dependencies through symlinks. Add an isolated install of the packed artifact with fresh dependency resolution and the declared peer range. **Done:** ESM/CommonJS, declarations and custom-user integration work without workspace resolution help.

- [x] **H3 — Benchmark current authorization and bulk operations. Improvement.** Measure latency, query count and memory for realistic users/roles/permissions, repeated checks and planned inheritance/bulk operations. **Done:** publish a reproducible baseline and address demonstrated query/index bottlenecks; do not restore stale authorization caching to improve a benchmark.

- [x] **H4 — Verify large policy and malformed-data behavior. Verify.** Exercise large memberships/action sets, corrupted stored actions and deeply nested role trees if F2 lands. **Done:** errors are controlled, no accidental grants occur, and practical limits or complexity costs are documented.

- [x] **H5 — Review package contents and dependency footprint. Verify.** Keep required JavaScript, declarations, licensing, README and consumer guidance; exclude test databases, credentials, build-only tooling and accidental generated content. **Done:** tarball assertions and a real install pass, including after release version substitution.

## I. CI, publishing and release operations

- [x] **I1 — Harden release-tag handling. Confirmed workflow gap.** Validate semantic versions and pass GitHub tag values through environment variables rather than interpolating them into shell source. Quote command arguments and reject malformed/duplicate release requests. **Done:** dry-run cases cover stable, prerelease and invalid tags without invoking publication.

- [x] **I2 — Align release metadata and artifact versions. Confirmed workflow gap.** Stable versus prerelease status must agree across GitHub, npm dist-tags, the package, docs and changelog. The current workflow uses npm `next` for prereleases but hardcodes GitHub `prerelease: false`. **Done:** dry runs prove stable and prerelease outputs are consistent.

- [ ] **I3 — Verify publishing authorization and provenance. Verification gap.** Inspect the actual npm trusted-publisher/environment configuration, repository permissions and intended release controls. **Done:** publishing identity and provenance are confirmed for this repository/workflow; no long-lived token is introduced without need.

- [x] **I4 — Apply least-privilege and reproducible workflow dependencies. Improvement.** Review permissions, pin third-party actions to reviewed commits with an update process, and avoid an unreviewed moving `npm@latest` toolchain. **Done:** CI/release/docs workflows function with only their required privileges and recorded tool versions.

- [x] **I5 — Publish the artifact that was validated. Verify.** Keep lint/types/tests/build/consumer checks ahead of publishing and ensure version changes do not invalidate the tested tarball. Plan retry behavior if npm publication succeeds but GitHub release/docs steps fail. **Done:** release rehearsal records artifact contents/version and recovery steps without republishing or mutating an existing version.

- [x] **I6 — Prepare upgrade notes and choose the release version. Required decision.** Compare the new package with the latest published release, including Node/Sequelize minimums, authoritative authorization reads, startup/error behavior, schema changes and added features. **Done:** choose the semantic version from the actual compatibility impact, document migrations and operational costs, and reconcile stale manifest/version statements.

- [x] **I7 — Complete release-candidate acceptance. Release gate.** Exercise a clean new app and an upgraded existing app, review all remaining findings, and independently review security/schema changes. **Done:** the exact release commit passes the supported CI/dialect/consumer matrix, remaining limitations are explicit, and no unresolved issue can silently grant unintended access or lose data.

## Implementation order and release decision

1. **Authorization correctness:** A1–A8, with regression tests first.
2. **Database compatibility:** B1–B8 and the relevant C contracts; establish migrations before expanding the schema.
3. **Original roadmap:** design and implement F1–F3 on the corrected policy/schema foundation, with explicit compatibility decisions.
4. **Documentation and agent support:** E and G, using tested final APIs. Contributor guidance G1 can land earlier.
5. **Dependency and release work:** D, H and I. Remove obsolete tooling and prepare release safety checks in parallel with independent work where practical.

Do not wait for the last step to write tests, update public declarations or correct affected examples. Each implementation PR must carry those changes and its rollback/compatibility notes where applicable.

A release decision should name the completed checklist IDs, any explicitly removed scope, the exact commit and version, test evidence, required database migrations and known limitations. Publishing is a separate action; this checklist does not publish or schedule a release.
