# Category G — contributor and consumer AI support

Implemented on the shared `fix/pre-release-hardening` branch. No commit, push, PR, merge or publication performed by this category.

## Files and contracts

- Root `AGENTS.md`: contributor layout, supported Node/Yarn, source and packed-consumer validation commands, generated-file boundaries, authentication/schema/connection ownership and links to dated review/release gates.
- `skills/sequelize-guard/SKILL.md`: one portable consumer skill with Agent Skills metadata, supported installed package/ORM/runtime range, real public APIs, explicit readiness/schema separation, verified identity and administrative policy checks, custom users and required fields, denial versus infrastructure errors, allow-only grammar, writer/transaction limits and persistent grant/revocation tests.
- `skills/sequelize-guard/references/installed-package.mjs`: resolves the public entry point from the consuming application's current working directory, walks to the matching on-disk manifest and returns actual version, package root, examples and skill paths. It requires no package.json export or repository-relative path and also works when copied away from the installed package.
- `packages/sequelize-guard/package.json`, `vite.config.mts`: explicit staging and manifest entries for the two skill files and canonical `examples/{README.md,basic.mjs,basic.cjs,custom-user.ts,migrations.mjs,authorization.mjs,advanced.mjs,upgrade.mjs}`. Examples themselves and their prose belong to E; H owns the exact tarball allowlist, installed recipe execution, copied-byte comparisons and detector assertion in `scripts/test-package.mjs`.
- `packages/sequelize-guard/project.json`: named inputs include shipped skills/examples, AI/docs validation scripts and docs discovery sources; changing these invalidates relevant Nx work.
- `apps/sequelize-guard-docs/content/docs/ai-integration.mdx` and root `meta.json`: explicit load/copy instructions (no universal node_modules autodiscovery claim), installed version precedence, verified identity/database boundaries and canonical recipe discovery. The existing source configuration already includes processed Markdown and automatically collects this page; it is retained.
- `apps/sequelize-guard-docs/src/lib/ai-discovery.mjs`: short index resolves curated paths against the shared Fumadocs source, failing on missing pages.
- `src/app/llms.txt/route.ts` and `src/app/llms-full.txt/route.ts` under the docs app: version from the docs manifest, explicit text/plain headers and existing processed full-documentation source, now including the AI page.
- `scripts/test-ai-guidance.mjs`: metadata/version agreement, relative reference and explicit staging checks, detached version detector against an exports-restricted fixture, source-derived discovery links and optional real HTTP checks. HTTP checks require `DOCS_BASE_URL`; readiness has a ten-second deadline and individual requests have timeouts. The served check also verifies generated API HTML has a routable class href rather than a .mdx href.
- `.github/workflows/ci-test.yml`: source AI/docs checks and mandatory served HTTP validation after the docs production build on both Node lines. Next starts from the docs directory, with process cleanup and liveness checks before/after tests.

E added README links to the packaged skill, AI page and discovery index. No duplicate API reference or separate editor-specific instruction copies were added.

## Verification

- Node 22.17.1: Vite library build passed, staging 13 static items plus native ESM/CommonJS and declarations.
- Node 22.17.1: final docs production build passed all 91 pages after E corrected generated API routes; `/docs/ai-integration`, `/llms.txt` and `/llms-full.txt` were generated.
- Targeted ESLint for both route files and the discovery helper passed.
- `node scripts/check-docs.mjs` passed 48 documentation sources and 43 routes at the G checkpoint.
- `node --test scripts/test-ai-guidance.mjs`: three source/portable checks passed on Node 22 and Node 24. Without a served URL, the HTTP case is explicitly skipped.
- With the final production site running on loopback, `DOCS_BASE_URL=http://127.0.0.1:3197 node --test scripts/test-ai-guidance.mjs` passed all four checks on Node 22 and Node 24. This verifies actual plain-text index/full-text responses, package version and AI page inclusion, plus rendered API class links. Servers were stopped after checks.
- An initial served attempt collided with another docs build removing `.next/BUILD_ID`. It failed explicitly; E/G coordinated exclusive build/start, then the final checks above passed. Running Next/Fumadocs from the repository root also failed source.config resolution; CI uses the verified docs working directory.
- Parent reports actionlint passed all workflows after the G CI changes. H/parent own final exact stable/prerelease fresh tarball acceptance.

## Agent evaluations and remaining release gates

G did not self-grade or spawn evaluation agents. Parent ran three independent fresh-context integrations against the installed exact candidate archive and records their actual generated code, tool versions and results in [the evaluation report](../evaluations/2026-11-16/README.md). Those evaluations are distinct from deterministic metadata/Markdown checks.

There is no outstanding G implementation change at handoff. Final combined source/tests/package/dialect/replica acceptance, exact-revision API regeneration and release checklist decisions belong to the orchestrator. This report does not authorize publication or claim that unrelated release gates have passed.
