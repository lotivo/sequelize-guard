# Release improvement execution plan

The orchestrator owns integration, scheduling, design decisions, cross-category review and the final PR. Category agents use GPT-6.1 Sol with medium reasoning, as requested. The complete scope is the [52-item release checklist](./2026-11-16-release-readiness-checklist.md).

## Branch and execution rules

- Final integration branch: `pvaghela/release-improvements`.
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
| B | Schema, migrations, custom identities and database integration | Baseline; coordinate constraints with A | Integrated; final edge-case review running |
| D | Dependency/security cleanup and authentication example requirements | Baseline; owns dependency manifest/lock changes | D1–D3 integrated; D4/D5 await E |
| F | Bulk assignment, role inheritance, polymorphic role holders | Integrated A + B and user design choices | Running |
| C | Public API/types/options/lifecycle and compatibility audit | Integrated A + B + F | Waiting |
| I | CI/release hardening and dry-run checks | D; coordinate B database jobs and H consumers | Running |
| H | Contract matrix, isolated consumers, performance and acceptance | Integrated A + B + C + D + F | Waiting |
| E | Correct human documentation, shared executable recipes and API generation | Final implementation and validation contracts | Waiting |
| G | Agent instructions, packaged skill and discovery/evaluation | E fixtures and final public APIs | Waiting |

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
- All commits are on `pvaghela/release-improvements`; the worktree is clean.
- One PR describes the final behavior, compatibility changes, validation and any external checks that could not be completed. No claim of release readiness hides blocked acceptance work.

## Integration evidence

- `449b245`: shared PostgreSQL/MySQL test drivers and pinned published 6.0.2 fixture dependency. Added by D for B's real migration compatibility checks.
- `dd29546`: D1 complete, obsolete ESDoc packages/config removed. Existing TypeDoc generation completed with zero errors (13 pre-existing declaration/JSDoc warnings); generated documentation is deferred to the final documentation phase.
- `142c7c4`: aligned Nx 24 and Vitest tooling, patched dependency paths, and corrected affected-project detection for JSON output. D validated clean frozen installs and full baseline checks on Node 22.17.1 and 24.15.0. The [dependency assessment](./2026-11-16-dependency-assessment.md) records all 47 GitHub alert dispositions, two residual exposure assessments, and final security-documentation requirements.
- `f4d761a`, `c6a5ee4`: atomic policy mutations, canonical identities, exact-token revocation, writer-backed administrative reads, and transaction/event regression tests. A validated 145 SQLite tests and six packed-consumer checks on both Node lines, plus PostgreSQL/MySQL concurrency checks.
- `afbf021`: model/migration schema parity, custom primary keys, constraints/indexes and explicit offline upgrades into distinct tables. The combined A+B+D branch passed lint, types, build, six packed checks and 162 SQLite tests on Node 22.17.1. B also validated PostgreSQL 17 and MySQL 8.4 integration.
- `eef42a1`: reproducible physical PostgreSQL standby test, including paused replication and an older transaction snapshot. B ran the isolated container exercise successfully; the integrated implementation will rerun it before final acceptance.

F's implementation design preserves the existing user junction and gives each registered holder type its own typed junction with real foreign keys. A singleton database lock serializes role-graph edits across processes. The new bulk APIs count newly assigned links, and inherited permission checks remain separate from direct role membership. These designs are under implementation, not completed checklist evidence.

I is preparing a 7.0.0 candidate because of changed policy, schema and compatibility contracts. Version preparation does not create a tag or authorize publication. Final release metadata and upgrade guidance are written after implementation settles.

Additional contract decisions during implementation: retain zero-database-work `ready` for `sync:false`; protect existing schema upgrades through explicit offline migration with original data preserved; avoid false commit notifications for caller-owned transactions when Sequelize cannot reliably signal commit success. Final implementations and tests must substantiate these contracts before corresponding items are checked off.
