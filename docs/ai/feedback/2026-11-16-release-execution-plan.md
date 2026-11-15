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
| A | Authorization, permission grammar, safe mutations and transactions | Baseline | Running |
| B | Schema, migrations, custom identities and database integration | Baseline; coordinate constraints with A | Running |
| D | Dependency/security cleanup and authentication example requirements | Baseline; owns dependency manifest/lock changes | Running |
| F | Bulk assignment, role inheritance, polymorphic role holders | Integrated A + B and user design choices | Waiting |
| C | Public API/types/options/lifecycle and compatibility audit | Integrated A + B + F | Waiting |
| I | CI/release hardening and dry-run checks | D; coordinate B database jobs and H consumers | Waiting |
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

Additional contract decisions during implementation: retain zero-database-work `ready` for `sync:false`; protect existing schema upgrades through explicit offline migration with original data preserved; avoid false commit notifications for caller-owned transactions when Sequelize cannot reliably signal commit success. Final implementations and tests must substantiate these contracts before corresponding items are checked off.
