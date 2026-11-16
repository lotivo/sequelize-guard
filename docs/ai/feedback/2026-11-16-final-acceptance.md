# Candidate acceptance evidence

Candidate **6.1.0**, PR branch **fix/pre-release-hardening**, target **master**. The original handoff history is preserved. No merge, tag, release, npm publication or production migration is authorized or performed. The maintainer limits post-PR review/fix cycles to three, stopping earlier when no actionable changes remain.

## Local integrated validation

- Node 22.17.1 and 24.15.0, Yarn 1.22.22; frozen development install. Library lint, strict TypeScript and coverage pass with Nx caching disabled: **252 tests in 19 files**, 91.82% statements, 83.96% branches, 96.29% functions, 92.35% lines. An initial final lint run caught test import ordering; it was corrected and lint rerun successfully.
- PostgreSQL 17 on both runtimes: 5 migration/holder tests passed, 5 MySQL-only cases skipped. MySQL 8.4 on both: 9 passed, 1 PostgreSQL-only case skipped. Physical PostgreSQL standby exercise passed on each runtime. Services were isolated disposable containers.
- Two independent Sol/medium reviewers examined safety checkpoint `d8282c1`; no unresolved actionable security/schema findings. See [security review](./2026-11-16-cloud-security-review.md) and [schema review](./2026-11-16-cloud-schema-review.md). Runtime implementation has not changed since that checkpoint.
- Human docs lint/build passed on both Node lines, rendering 91 pages. Source/route checks cover 53 documentation sources and 43 docs routes. Served discovery/API checks pass on both runtimes, including actual `/llms.txt`, `/llms-full.txt` and rendered API links. TypeDoc uses package version and current source revision, and removes stale generated files. See [E evidence](./2026-11-16-e-continuation.md).
- Stable and prerelease archives are installed into fresh consumers on both Node lines: imports, strict declaration modes, published-6.0.2 upgrade, authenticated Express and other shared recipes, exact allowlist and portable detector. Final hashes/results are recorded in the [contract matrix](./2026-11-16-public-contract-matrix.md). Shipped README/license/skill/reference/examples are byte-compared with source. The actual release `sha256sum -c` command accepts the original and rejects an intentionally modified disposable copy.
- Three independent Sol/medium agents integrated the installed package without repository source: [tasks, generated code, results and final-archive reruns](../evaluations/2026-11-16/README.md). These are actual integration trials, separate from Markdown/route validation.
- Release metadata unit tests pass on both Node lines. Live registry preflight accepts unpublished 6.1.0 and 6.1.0-rc.1 with latest/next metadata; no publication is invoked. SHA-verified actionlint 1.7.12 validates all workflows. Workflow shell syntax is checked. Source CI now executes guidance/source checks and serves docs to test discovery/API output.
- Fresh Yarn audit retains exactly the previously assessed minimatch and UUID advisory identities (16 moderate dependency paths, no high/critical paths). See [exposure assessment](./2026-11-16-dependency-assessment.md); runtime UUID exposure is not misclassified using Yarn's development labels. No incompatible blanket override was introduced.

## Evidence by checklist item

Test names in this table refer to `packages/sequelize-guard/src/__tests__`; packed checks are in `scripts/test-package.mjs`. “Verified” means the named local evidence exists, not a claim of production deployment. Hosted CI/PR results are recorded separately below.

| ID | Status | Concrete evidence |
| --- | --- | --- |
| A1 | Verified | policy/roles tests: individual action removal, shared grants, wildcards, repeat/missing removal. |
| A2 | Verified | permissionGrammar, policy and performance contracts: exact tokens, malformed request denial and persisted JSON rejection. |
| A3 | Verified | policy/permissions: canonical sets, explicit-name conflicts, role normalization, case-sensitive checks. |
| A4 | Verified | policy/revocation and live dialect interleavings: serial writes, unique identities, rollback and no lost grant updates. |
| A5 | Verified | policy/roles safeguard cases, archived links and children; opt-out cleanup and atomic failure regression. |
| A6 | Verified | allow-only implementation, deprecated allow declarations and matching security/permissions documentation. |
| A7 | Verified | cross-connection policy/admin reads and direct administrative read-outage regressions. |
| A8 | Verified | policy/events/archived-grants: operation savepoints, rollback, commit failure and caller event suppression. |
| B1 | Verified | migrations tests and dialect CRUD for timestamp/paranoid combinations; real init exclusive DDL assertions. |
| B2 | Verified | inspected FK/unique/index metadata, orphan rejection, junction isolation and SQLite schema index regression. |
| B3 | Verified | migrations/holders plus strict packed custom-user recipe and independent string-key integration. |
| B4 | Verified | custom table/schema/identity tests, physical SQLite naming and offline migration guidance. |
| B5 | Verified | ownership/receipt/failure retry regressions, competing MySQL creates, failed cleanup and interrupted rollback preservation. |
| B6 | Verified | exact published 6.0.2 packed fixture upgrade, preserved IDs/users/source tables, rollback and explicit parent opt-in. |
| B7 | Verified | PostgreSQL 17 and MySQL 8.4 migration+holder suites on both supported runtimes. |
| B8 | Verified | physical standby harness on both runtimes, lagging reader and older snapshot limitations documented. |
| C1 | Verified | init/sync/misc/options tests; immutable schema configuration and live binding fingerprints reject before SQL. |
| C2 | Verified | native packed consumers and strict mts/cts/Bundler positive/negative type fixtures. |
| C3 | Verified | init/model registration/method collision tests, one guard per connection and caller model preservation. |
| C4 | Verified | control/events/policy tests for incomplete/consumed builders and committed best-effort notifications. |
| C5 | Verified | cache/lifecycle tests preserve caller connections and bounded manual-cache timers/listeners. |
| C6 | Verified | README, compatibility/upgrade guide, manifests and CI agree on Node22/24, Sequelize6.37.8, dialect/module/type matrix. |
| D1 | Verified | ESDoc removal preserved; TypeDoc generation and production docs builds pass. |
| D2 | Verified | refreshed frozen-lock audit matches two fully assessed residual advisories; exposure limits retained. |
| D3 | Verified | frozen install, aligned tool families, both runtime source/build/consumer checks without major overrides. |
| D4 | Verified | real Express recipe tests no/forged credentials, reader admin denial without mutation, trusted grant, revoke and sanitized infrastructure failure. |
| D5 | Verified | SECURITY.md/guide private reporting, application auth/admin ownership, writer/snapshot/event/expiry limits. |
| E1 | Verified | guides, README, landing/blog and root examples corrected; obsolete migration reports explicitly archived. |
| E2 | Verified | seven shared installed-archive recipes cover ESM/CJS/strict custom user, migrations, advanced holders and published upgrade. |
| E3 | Verified | matching executable production migrations and startup/ready/sync/builder guidance; no production force-sync recipe. |
| E4 | Verified | unsupported compatibility/cache/audit/expiry claims replaced with tested contracts and limits. |
| E5 | Verified | manifest/revision-bound TypeDoc, stale-tree removal probe and exact release workflow source selection. |
| E6 | Verified | source/route checker, repaired generated API hrefs and live rendered API/discovery assertions. |
| F1 | Verified | bulk-assignment normal/empty/invalid/repeat/cross-connection/failure tests and archived membership counts. |
| F2 | Verified | inheritance/direct-role separation, cycle/orphan/concurrency/deep graph and parent commit failure tests. |
| F3 | Verified | separate typed holder junctions, same-ID isolation, soft-deleted principals, dialect and archive recipes. |
| G1 | Verified | root AGENTS.md actual source layout and executed contributor commands, generated-source boundaries. |
| G2 | Verified | portable skill and copied detector checks, real installed examples and independent integrations. |
| G3 | Verified | deliberate 19-file archive, skill/reference/examples shipped, source/discovery links and live llms routes. |
| G4 | Verified | three fresh-context Sol/medium integration trials plus final archive reexecution, retained generated code. |
| H1 | Verified | public-contract matrix including direct wrapper outage/rollback families; no silent conditional test assertions. |
| H2 | Verified | fresh npm exact-archive stable/RC consumers on Node22/24, no workspace resolution assistance. |
| H3 | Verified | reproducible machine/artifact-bound latency/query/heap sample; one writer query per authorization scenario. |
| H4 | Verified | large memberships/actions, 256-depth lineage, 2,000 irrelevant grants, malformed/100KB/nested JSON cases. |
| H5 | Verified | exact archive allowlist, manifest/source-byte equality and fresh production dependency footprint. |
| I1 | Verified | malformed/wrong-base/duplicate/tag injection tests and read-only registry preflight. |
| I2 | Verified | stable latest/normal versus RC next/prerelease metadata, manifest/archive version assertions and candidate changelog. |
| I3 | External limitation | Maintainer confirmed npm trusted publisher; historical provenance and GitHub controls inspected in handoff. Private npm registration and candidate OIDC exchange are not independently exercised; publishing is unauthorized. |
| I4 | Verified | Pinned actions, narrow permissions and static checks; all eight GitHub CI jobs pass at c187433 in run 43785554785. |
| I5 | Verified | exact stable/RC archive checks, checksum tamper rejection and publication recovery documentation; nothing published. |
| I6 | Verified | maintainer-selected6.1.0, immutable6.0.2, root changelog and explicit policy/schema/offline rollback compatibility notes. |
| I7 | Verified | Local full matrix, separate safety reviews, clean second PR review and all eight hosted CI jobs at reviewed source 3b36466 pass. |

## Operational limits

MySQL interrupted nontransactional rollback/failed cleanup can require manual operator recovery; automatic adoption is intentionally refused. Incoming-FK preflight needs cross-schema metadata visibility and quiescent DDL. Authorization is writer-backed but not atomic with later application work; older snapshots/in-flight checks can see earlier state. Events are not durable audits. These documented contracts are covered by tests, not unresolved silent authorization/data-loss findings.

## Hosted acceptance and bounded PR review

[PR #49](https://github.com/lotivo/sequelize-guard/pull/49) targets master from the separate branch and remains unmerged. [Initial hosted CI](https://github.com/lotivo/sequelize-guard/actions/runs/43785554785) passed all eight jobs at `c187433`: two build/docs/source jobs, four database jobs and two fresh-consumer jobs. Both PostgreSQL jobs also execute the physical standby harness. Vercel's automatic PR preview passed. No Codex review comments or GitHub review submissions were present when checked.

Post-PR round 1 used three independent Sol/medium reviewers for security, schema and release/docs. Security and release reviews found no actionable issue. Schema review identified one P2 documentation contradiction: incremental `addRoleHolders` accepts only new registrations, while the guide implied repeating existing ones. Commit `0c24659` corrects the guide and API comment and expands the packed advanced recipe to preserve existing membership/inheritance across a separate deployment connection while adding a new holder. It rejects repeated registration, proves same-ID isolation and preserves application tables on rollback. Runtime behavior is unchanged. Updated exact archives and the second review round follow this correction.

Post-PR round 2 at `3b36466` is clean. Separate schema and release/docs reviewers confirmed the registration finding is resolved, the generated API source revision matches the implementation, the recipe preserves existing memberships/inherited grants and isolates the new holder, and the revised archives match source and pass all four fresh-consumer runs (10/10 each). No additional actionable findings were identified; no third review round is needed. No runtime behavior changed during PR review, only migration API prose and the executable recipe. The retained independent-agent integrations were also rerun successfully against the corrected stable archive.

[Corrected-head hosted CI](https://github.com/lotivo/sequelize-guard/actions/runs/43786195505) passed all eight jobs at reviewed source `3b36466`. The final bookkeeping commit only records these results, checklist status and evaluation history; it does not alter implementation, packaged content, executable recipes or rendered documentation. I3 remains the only unchecked item because private npm registration was not independently inspected and no publication was authorized. GitHub comments contained Vercel/Coveralls status reports and no Codex findings.

The user caps post-PR review/fix rounds at three. Work stops after the clean second round and final hosted validation; no merge is performed. Do not mark I3 complete from the maintainer confirmation alone or claim an authorized release.
