# Independent installed-package agent evaluations

Three separate Codex subagents were explicitly configured as **gpt-6.1-sol, medium reasoning** with fresh context. Each received a small existing application fixture and a task, read the installed consumer skill first, and could inspect installed examples/declarations. They were instructed not to read repository source, other evaluation folders, or modify the installed library. This is observed agent integration evidence, not a claim that deterministic Markdown checks establish agent quality.

All used a fresh npm installation outside the workspace of the exact stable archive SHA-256 `5c34be3e4d56dcd2f20e9632cb263ff5cfd11e672612c9ad4309ead7a545c244`. Resolved dependencies included Sequelize Guard 6.1.0, Sequelize 6.37.8, SQLite driver 6.0.1 and TypeScript 5.9.3. Source package version and installed paths were checked using the shipped detector. No production services, network credentials or application data were used.

| Task and supplied fixture | Observed result |
| --- | --- |
| Existing app: supplied Account table with required email, verified session lookup and unguarded document read. Add authorization and an admin-only fixed grant operation without replacing authentication or user storage. | Node 22.17.1: 3 tests passed. Matching explicit migration/UserModel configuration, zero automatic provisioning, initial denial, forged/no identity rejection, unchanged policy after unauthorized administration, admin grant, allowed read, action/membership revocation, missing migration and actual closed-database 503, account preservation on rollback. |
| Custom user: supplied strict TypeScript Account with string accountKey mapped to physical account_key, mandatory email and existing data. Integrate without changing its schema or required fields. | Node 24.15.0 / TypeScript 5.9.3: strict NodeNext compilation and runtime assertions passed. Five negative type cases, zero-query sync:false startup, physical FK target, new/old user values, grant/assignment/denial/revocation, and migration.down preservation. |
| Revoked access: supplied app memoized its initial authorization answer in a Map. Diagnose access remaining allowed after awaited committed revocation. | Node 22.17.1: regression failed against the original app (`true !== false` after committed action revocation), then passed after removing the application decision cache. Tests cover warmed checks, regrant, committed membership revoke, malformed denial and genuine database-failure rejection. No cache-clearing workaround, timer or schema reset. |

The generated source and assertions are retained alongside this report. The parent inspected the outputs for identity provenance, administrative checks, actual persistence, rollback preservation and error handling. No guidance correction was necessary from these three trials. Agents corrected ordinary test-development issues (double connection close and use of an untyped Sequelize property). The seed fixture's `sqlite::memory:` URL emits a Node deprecation warning; production examples use structured connection options where practical. These three successful trials do not prove arbitrary integrations safe.

Final artifact verification: the packaging equality check detected two guidance edits newer than the original evaluation archive (explicit Express install dependency and lowercase `sequelize` in migration prose). The final archive was rebuilt as SHA-256 `609653bef29e45f36d017163ac59cabcb851fd597687f89169e7e5c1c791301c`. The parent installed that exact replacement and reran all generated integrations unchanged: four Node 22 tests passed, and the Node 24 strict TypeScript compilation/runtime assertions passed. This final run validates the generated code against the final package; it does not pretend the original agents saw later prose.

After PR review clarified incremental holder registration and expanded the advanced recipe, the stable archive became SHA-256 `f2fc46e48840c05c7b424c9a320648611cd5db7ce28cf505ec3c2d4fbdb1f9b6`. All retained integration tests and strict custom-user compilation/runtime assertions were rerun unchanged and passed against that exact replacement. The original independent trials remain the agent-behavior evidence; these later executions verify compatibility with the final reviewed archive.

To reproduce the generated integrations, copy this directory to a disposable directory outside the repository, install the exact candidate archive plus `sequelize@6.37.8 sqlite3@6.0.1 typescript@5.9.3 @types/node@24.10.1` in that directory, then run:

```sh
node --test existing-app/integration.test.mjs revoked-access/regression.test.mjs
node node_modules/typescript/bin/tsc --project custom-user/tsconfig.json
node custom-user/dist/integration.mjs
```

Use the pinned Node line in the table for each original result. This reproduces the generated code's assertions; repeating the agent behavior requires fresh agents and the task/fixture descriptions above. These evaluation files are repository evidence and are deliberately absent from the npm archive.
