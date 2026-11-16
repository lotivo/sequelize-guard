# Category E — human documentation and executable contracts

## Scope

Replaced every current application guide/example/migration page, README, landing screen and the historical blog's obsolete APIs/claims. Added root CHANGELOG.md for the 6.1.0 candidate and SECURITY.md. Repository docs/EXAMPLES.md now links the same canonical fixtures; the old external v5-to-v6 guide is an explicit historical note linking current guidance, and both internal migration reports are labeled historical. Dated AI feedback reports remain historical evidence, not current integration tutorials.

The guides distinguish automatic ready, explicit sync, static production migration and fluent policy initialization. They cover the published-6.0.2 distinct-prefix offline copy, physical-name inventory/ignored old options, canonical-role remediation preserving IDs, opt-in legacy inheritance, backup/cutover/rollback, external FKs, application-owned identities/holders and MySQL interrupted-DDL manual recovery. Compatibility includes deliberate 6.1.0 behavior changes, Node22/24, Sequelize^6.37.8, tested dialects and strict module-resolution modes. No Sequelize7, blanket compatibility, cached authorization, automatic durable audit or timer-expiry guarantee remains.

Security guidance documents verified application identity, protected policy administration, exact-token wildcards/grammar, writer reads and transaction/in-flight limits, reject-versus-deny semantics, object/tenant authorization, private vulnerability reporting and the assessed dependency limitations. It does not represent the candidate as already published.

## Canonical fixtures

- examples/basic.mjs: ESM/automatic ready, grant/assignment/action revocation/membership revocation/malformed denial.
- examples/basic.cjs: native CommonJS, sync:false/manual sync and fluent builder.
- examples/custom-user.ts: strict custom string-key user with mandatory attributes, migration and app-data-preserving rollback.
- examples/migrations.mjs: separate static deployment migration and sync:false worker startup.
- examples/advanced.mjs: separate holder identities with identical numeric IDs, single-parent inheritance/cycle denial, inherited revocation, caller transaction commit/rollback, event suppression/unsubscribe and holder preservation on rollback.
- examples/authorization.mjs: real Express5.1 adapter around the shared handler, injected verified-session dependency and real Guard persistence. Assertions cover absent/forged credentials, forged actor ID, non-admin mutation denial with unchanged policy, allowed administrator mutation, protected reads, committed revocation, verifier outage and real database outage with sanitized503.
- examples/upgrade.mjs: H's actual published6.0.2 custom-user recipe extracted into a shared file, with narrowly scoped legacy Lodash bridge, unique disposable database, source-membership preservation and destination rollback preserving application data.

H owns scripts/test-package.mjs, which executes the packaged copies in a clean exact-archive consumer and strictly compiles/runs the TypeScript fixture. G explicitly packages these same files and links them from its skill; no separate human/agent snippet implementation is maintained.

## Generator and discovery verification

scripts/generate-api-docs.mjs uses the library manifest version instead of monorepo0.0.0, validates DOCS_SOURCE_REVISION against the checked-out commit, runs local TypeDoc without network inference, replaces the entire generated tree, and emits absolute rendered docs routes. A rendered-HTML check found the previous relative classes/Foo.mdx links were broken; those links are now canonical /docs/api/classes/Foo routes. The generated index records version6.1.0 and checkout revision89f2407d2440a4ecaf38d3159582965c864b25cd; its local preview caveat explicitly acknowledges uncommitted source. Regenerate at the final chosen release checkout before publishing stable docs.

Generation passed with zero errors and nine existing referenced-unexported-type warnings. A deliberately injected stale API file disappeared on regeneration. A different DOCS_SOURCE_REVISION (HEAD^) was rejected before generation. scripts/check-docs.mjs passes53 sources/43 routes, including all maintained non-AI repository docs, local files, navigation, generated href restrictions, nested nonexistent-API rejection and manifest-version checks. Examples navigation now uses Fumadocs meta.json rather than ignored _meta.json. git diff --check passed.

Node22 docs lint and production build passed; final G-exclusive build generated91pages and its served discovery/API suite passed4/4 (actual llms.txt/full and absolute API hrefs). Node24 docs lint and production build passed91pages before the final href correction. The last subsequent edits to application docs refine two deletion-safeguard paragraphs only; final integrated rebuild remains orchestrator-owned. H subsequently reports all four stable/RC exact-archive runs on Node22/24 passed10/10 each, including the packaged shared fixtures and strict compiled TypeScript execution. The orchestrator also reports all three independent actual agent integration evaluations passed. These are coordinated acceptance results, not inferred from source.

No commit, push, PR, merge, tag, release or production migration was performed by E. External network-link availability, actual publication and final integrated release-revision acceptance remain separate operational gates.
