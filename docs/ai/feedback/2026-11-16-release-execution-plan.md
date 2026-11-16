# Release improvement execution plan

The orchestrator owns integration, scheduling, design decisions, cross-category review and the final PR. Category agents use GPT-6.1 Sol with medium reasoning, as requested. The complete scope is the [52-item release checklist](./2026-11-16-release-readiness-checklist.md).

## Paused handoff — 16 November 2026

The maintainer stopped local implementation and requested a committed remote handoff for Cloud Codex. All category agents are stopped. Continue from `pvaghela/release-cloud-handoff`; the original `pvaghela/release-improvements` branch remains at `4543e7e`. The handoff branch contains all collected implementation commits, including unfinished C/F fixes. No PR, merge, tag or publication was performed for this handoff.

Read the [cloud handoff](./2026-11-16-cloud-handoff.md) first for the current failures, preserved contracts and ordered next steps. At implementation commit `593038b`, Node 22 lint and typecheck pass; SQLite tests report **223 passed, 3 failed**. Earlier green results below belong to earlier commits, not the assembled handoff.

## Branch and execution rules

- Current handoff/integration branch: `pvaghela/release-cloud-handoff`.
- One agent owns each category A–I. Agents work in isolated temporary worktrees and make focused commits; the orchestrator integrates those commits into the final branch.
- No agent pushes, creates PRs, merges, publishes, or posts GitHub comments. The orchestrator creates one PR when integration and checks are complete. This task does not authorize publishing a release.
- Three category agents may work concurrently. Dependent work waits for integrated prerequisites.
- User-facing documentation and AI recipes come after implementation contracts settle. Earlier agents supply documentation handoff notes without editing guides or README. Planning/progress records may be maintained throughout.
- Each agent returns completed checklist IDs, exact commits, test evidence, compatibility/rollback notes, remaining limitations and documentation handoff points. A verification gap is not marked complete merely because it was documented.
- The orchestrator reviews each diff, resolves overlap with the owning agents, runs integration checks, and obtains independent review of security/schema changes before the final PR.

## Work schedule

| Category | Responsibility | Prerequisites | State |
| --- | --- | --- | --- |
| A | Authorization, permission grammar, safe mutations and transactions | Baseline | Integrated; final API/docs review pending |
| B | Schema, migrations, custom identities and database integration | Baseline; coordinate constraints with A | Integrated; receipt lifecycle and binding review still open |
| D | Dependency/security cleanup and authentication example requirements | Baseline; owns dependency manifest/lock changes | D1–D3 integrated; D4/D5 await E |
| F | Bulk assignment, role inheritance, polymorphic role holders | Integrated A + B and user design choices | Integrated with unfinished follow-up fixes; paused |
| C | Public API/types/options/lifecycle and compatibility audit | Final audit after integrated F; independent lifecycle work can start earlier | Integrated with unfinished immutability fix; paused |
| I | CI/release hardening and dry-run checks | D; coordinate B database jobs and H consumers | Workflows integrated; final acceptance pending |
| H | Contract matrix, isolated consumers, performance and acceptance | Integrated A + B + C + D + F | Fresh consumers and performance integrated; final acceptance pending |
| E | Correct human documentation, shared executable recipes and API generation | Final implementation and validation contracts | Not started; paused |
| G | Agent instructions, packaged skill and discovery/evaluation | E fixtures and final public APIs | Not started; paused |

D4/D5 security prose and examples are handed to E for final writing; D remains responsible for their security acceptance criteria. C6 compatibility prose and I6 upgrade notes likewise land in the final documentation phase. Final release approval is not implied by preparing the PR.

## Confirmed design choices

The user confirmed these choices on 16 November 2026:

1. Role hierarchy: single parent, inherited permissions, direct-membership role checks.
2. Allow/deny: allow-only semantics with explicit deprecation of the unused field.
3. Polymorphism: registered models hold roles; permissions remain attached to roles.

No production data changes or release publication are part of this task. Category A will preserve non-whitespace Unicode/punctuation permission tokens, reserve whole-token wildcards, reject extra grammar tokens, and canonicalize action sets while recognizing equivalent legacy stored definitions.

## Final integration gate

- Every checklist item has implementation/verification evidence or an explicit user-approved scope change.
- Full supported Node/dialect/consumer checks pass on the integrated branch, including installed-tarball examples and documentation/skill validation.
- Security/schema changes receive an independent review and resulting fixes are rechecked.
- All commits are on `pvaghela/release-cloud-handoff`; the worktree is clean.
- One PR describes the final behavior, compatibility changes, validation and any external checks that could not be completed. No claim of release readiness hides blocked acceptance work.

## Integration evidence

- `449b245`: shared PostgreSQL/MySQL test drivers and pinned published 6.0.2 fixture dependency. Added by D for B's real migration compatibility checks.
- `dd29546`: D1 complete, obsolete ESDoc packages/config removed. Existing TypeDoc generation completed with zero errors (13 pre-existing declaration/JSDoc warnings); generated documentation is deferred to the final documentation phase.
- `142c7c4`: aligned Nx 24 and Vitest tooling, patched dependency paths, and corrected affected-project detection for JSON output. D validated clean frozen installs and full baseline checks on Node 22.17.1 and 24.15.0. The [dependency assessment](./2026-11-16-dependency-assessment.md) records all 47 GitHub alert dispositions, two residual exposure assessments, and final security-documentation requirements.
- `f4d761a`, `c6a5ee4`: atomic policy mutations, canonical identities, exact-token revocation, writer-backed administrative reads, and transaction/event regression tests. A validated 145 SQLite tests and six packed-consumer checks on both Node lines, plus PostgreSQL/MySQL concurrency checks.
- `afbf021`: model/migration schema parity, custom primary keys, constraints/indexes and explicit offline upgrades into distinct tables. The combined A+B+D branch passed lint, types, build, six packed checks and 162 SQLite tests on Node 22.17.1. B also validated PostgreSQL 17 and MySQL 8.4 integration.
- `eef42a1`: reproducible physical PostgreSQL standby test, including paused replication and an older transaction snapshot. B ran the isolated container exercise successfully; the integrated implementation will rerun it before final acceptance.
- The orchestrator reran the physical standby harness successfully on the combined branch. `e5d5ef5` adds ambiguous-table-name and unsafe SQLite BIGINT preflights; the integrated suite remains at 162 passing tests.
- Independent foundation review identified three migration risks: unverified table ownership on rollback, MySQL concurrent-create cleanup, and noncanonical legacy role names that cannot be revoked through normalized names. B reproduced and fixed all three in `b592f15`, including regression tests and an additional SQLite external-reference rollback safeguard. Independent re-review and final integrated acceptance remain pending. F additionally gates activation of previously inert parent pointers during upgrade.
- `c071411`, `7976135`: 7.0.0 candidate metadata, isolated release jobs, pinned workflow actions, exact-artifact consumers and safe tag validation. Preliminary stable and prerelease rehearsal artifacts passed seven checks each on both Node lines, with unchanged checksums and tamper rejection. The [workflow assessment](./2026-11-16-release-workflow-assessment.md) records evidence and remaining final-acceptance work. The maintainer confirmed the private npm trusted-publisher mapping on 16 November 2026.
- `eddb4c6`: atomic bulk assignment foundation, validated by F with 166 SQLite tests and type checking. F's final shared membership implementation will additionally validate collection input shapes and graph-lock concurrency before completion.
- `b592f15`: reproduced and fixed all three independent migration findings; protects application references on SQLite rollback as well. The combined branch passed 170 tests, lint, types, build and six package checks on Node 22.17.1. Independent review snapshots are preserved in the cloud handoff; final re-review remains pending.
- `c7c8843`: maintainer-selected 6.1.0 candidate, keeping the package major aligned with Sequelize 6. Updated stable and prerelease rehearsal archives each passed seven checks on Node 22.17.1 and 24.15.0; the workflow assessment records their preliminary checksums. Nothing was tagged or published.

F's implementation design preserves the existing user junction and gives each registered holder type its own typed junction with real foreign keys. A singleton database lock serializes role-graph edits across processes. The new bulk APIs count newly assigned links, and inherited permission checks remain separate from direct role membership. These features are integrated, but unfinished review fixes and final acceptance prevent marking the category complete.

The maintainer selected 6.1.0, keeping package majors aligned with Sequelize majors. Version 6.0.2 is already published and cannot be replaced. The upgrade guide must still explicitly describe changed policy, schema and compatibility contracts; the version choice is not a claim of unchanged behavior. Version preparation does not create a tag or authorize publication. Final release metadata and upgrade guidance are written after implementation settles.

Additional contract decisions during implementation: retain zero-database-work `ready` for `sync:false`; protect existing schema upgrades through explicit offline migration with original data preserved; avoid false commit notifications for caller-owned transactions when Sequelize cannot reliably signal commit success. Final implementations and tests must substantiate these contracts before corresponding items are checked off.

## Collected at pause

- `f31b507`, `3488618`: inheritance, registered model role holders and dialect CI coverage.
- `dd1fcea`: MySQL incoming application-reference preflight.
- `9999975`, `0ad4907`, `08a95f5`: API/lifecycle ownership, inferred custom-user declarations, shared migration options and writer-backed user roles.
- `6d88b8f`, `4543e7e`: ownership receipts and exact physical table identity handling.
- `92426c4`, `134388e`, `90686e8`: fresh npm tarball consumers, bounded permission projection, large-policy coverage, benchmark and indexed grant reads.
- `b6a1b14` **WIP**: immutable schema options. Live Sequelize/model metadata drift still needs review.
- `593038b` **WIP**: receipt lifecycle, policy binding and archived-link restoration. Three SQLite tests fail at this assembled commit; fixes and independent review remain required.

No unchecked item in the 52-item checklist is certified complete by collecting its code. Update evidence item by item after final implementation and verification. E (human documentation) and G (agent support) have not started.
