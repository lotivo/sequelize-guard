# AI support plan for Sequelize Guard

Add concise guidance for agents maintaining this repository and for agents using the published package in another application. Keep examples executable and tied to the package version, so guidance follows the real API as the maintenance fixes land.

## Scope

- In: contributor `AGENTS.md`, one reusable package-integration skill, tested usage examples, discovery through README/package/docs, and checks for stale or missing content.
- Out: an MCP server, agent SDK, hosted AI service, automatic permission changes, new authorization APIs, and separate copies of instructions for every editor.

## Existing foundations

- Public declarations and `scripts/test-package.mjs` provide the starting point for checking examples against the actual npm artifact.
- The docs app already serves `/llms-full.txt` through `apps/sequelize-guard-docs/src/app/llms-full.txt/route.ts`, using `getLLMText` in `src/lib/source.ts`. Reuse this route.
- Some current documentation describes nonexistent APIs such as `guard.users` and `guard.cache`. Correct those sources before directing agents to the full documentation dump.
- The maintenance review identifies unresolved cache revocation and initialization issues. Agent guidance must distinguish current behavior from planned fixes.

## Action items

- [ ] **Add repository guidance in root `AGENTS.md`.** Document the workspace layout, supported Node/Yarn versions, frozen installation, lint/typecheck/test/build/packed-consumer commands, and where public exports and prototype extensions live. Require corresponding declaration, consumer-test and documentation changes when public APIs change. Keep generated build, coverage and API docs out of hand edits. Link to the maintenance review for current limitations. This file is for contributors; it does not automatically configure agents in consuming applications.

- [ ] **Establish executable usage examples.** Extract reusable ESM, CommonJS and TypeScript fixtures from the consumer checks before adding more examples. Cover construction and `await guard.ready`, granting a role, assigning an authenticated user, checking an action/resource, and a denial. Add a custom UserModel example against its supported key configuration. Use Sequelize 6 and the actual exported methods; do not invent a repository/service wrapper or nested API. Render or include these same fixtures in the human and agent guides rather than maintaining independent code copies.

- [ ] **Add one portable skill at `skills/sequelize-guard/SKILL.md`.** Use the Agent Skills format, with `name: sequelize-guard`, a clear activation description, and compatibility metadata for the supported package/ORM range. Its workflow should inspect the installed version, module format, Sequelize instance, authenticated principal and schema-management setup; select a tested recipe; add allow/deny tests; and verify using the application's existing tools. Keep longer API, custom-model and migration notes in adjacent `references/` files only where needed.

- [ ] **Make security and database boundaries explicit.** Applications authenticate users and authorize administrative mutations. Never trust a user ID supplied directly in a request header as authentication. Do not recommend force-sync, table deletion, production schema changes or a cache-consistency guarantee without evidence. Explain revocation limitations until their fixes and tests land. Keep `ready`, schema synchronization and fluent permission `init()` distinct. Teach supported error handling after readiness behavior is repaired.

- [ ] **Ship and expose the consumer guidance.** Copy the canonical skill directory into the staged npm package, include it in the manifest's `files`, and extend the tarball assertions to require the skill and referenced files. Link it from README and an AI integration docs page. Give an explicit example of loading/copying the skill into a user's chosen agent tool; do not claim every tool automatically discovers skills inside `node_modules`. Keep contributor instructions in the repository and package usage instructions in the distributable. Preserve existing package entry points.

- [ ] **Make the docs endpoint useful for discovery.** After correcting the underlying guides, include the AI integration page in the existing `/llms-full.txt` output. Add a short `/llms.txt` index pointing to the quick start, public API, migration/cache guidance and full text. Include the documented package version and generate links from the existing docs source where practical. Avoid a second independently maintained API reference.

- [ ] **Validate content and packaging in CI.** Run example fixtures against the packed package in both runtime formats and supported TypeScript resolutions. Check skill metadata, referenced-file existence, packaged content, and docs route output. Include denial, failed initialization and revoked access once the corresponding fixes land; never encode today's security defects as desired behavior. Ensure edits to the skill/examples invalidate the relevant Nx checks. Use existing tools and Node assertions rather than adding a framework just to validate Markdown.

- [ ] **Review with a small set of realistic agent tasks before the combined PR.** Try adding role checks to an existing app, integrating a custom UserModel, and diagnosing a revoked permission that still allows access. Check that the resulting code uses real exports, awaits initialization, preserves verified identity and existing tables, and includes an actual denial assertion. Record tool/version and observed results; do not call deterministic documentation tests proof of agent quality. This evaluation is a release review, not an API-funded CI requirement.

## Order and acceptance

1. Land the CI/package foundation and add contributor instructions.
2. Repair cache, readiness and migration behavior, then reconcile the examples and documentation with those contracts.
3. Add the consumer skill, package it, expose the docs links and run the acceptance checks on the same branch before the combined PR.

Done when a fresh consumer can find the guidance, run its examples against the tarball, and get correctly typed code with both allowed and denied authorization paths. All advertised commands must work from their documented directory; all relative skill references must work from the installed copy. Guidance must identify any remaining limitations without presenting proposed APIs as available.

No agent vendor is required for the first version. Select the user's preferred editor/agent during implementation for the manual evaluation; the files and automated checks remain portable.

## Format references

- [AGENTS.md](https://agents.md/) describes repository instructions and nested project guidance.
- [Agent Skills specification](https://agentskills.io/specification) defines the `SKILL.md` directory and metadata format. Tool installation/discovery support should be checked against the chosen client when documenting setup.
