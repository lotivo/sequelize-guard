# Working on Sequelize Guard

Run commands from the repository root. This is a Yarn 1.22.22/Nx monorepo; use Node 22.17.1 or Node 24.15.0 (the supported CI lines). Install development dependencies with `corepack yarn install --frozen-lockfile` before setting `NODE_ENV=production`.

## Editable sources

- `packages/sequelize-guard/src/index.ts`: public exports; `src/types/`: public contracts; `src/SequelizeGuard.ts`, `src/guard/` and `src/authorize/`: implementation and model extensions. Inspect actual paths before changing API behavior.
- `packages/sequelize-guard/src/__tests__/`: SQLite and real-dialect regression tests.
- `examples/`: canonical ESM, CommonJS, custom-user and authentication/migration recipes, executed against the packed package by `scripts/test-package.mjs`.
- `skills/sequelize-guard/`: portable **consumer** guidance included in npm. This root file is **contributor** guidance and does not configure agents in consuming applications.
- `apps/sequelize-guard-docs/content/`: human documentation; `src/app/llms.txt` and `llms-full.txt`: discovery routes.
- `packages/sequelize-guard/vite.config.mts` and `package.json`: staging/publication files. `scripts/test-package.mjs` enforces an exact archive allowlist.

Keep public implementation, declarations, regression/packed-consumer checks, canonical examples and documentation aligned in the same change. Changes to shipped guidance/examples require deliberate archive-allowlist updates. Never hand-edit `build/`, coverage output, `.source/`, `.next/`, or generated API pages under `content/docs/api/`. Regenerate API docs with `corepack yarn docs:generate` from the intended release revision.

## Validation

```sh
NODE_ENV=production NX_DAEMON=false NX_NO_CLOUD=true NX_ISOLATE_PLUGINS=false corepack yarn nx run-many -p sequelize-guard -t lint,typecheck,build,test:coverage,test:package --parallel=1 --skip-nx-cache --output-style=static
node --test scripts/test-ai-guidance.mjs scripts/release-metadata.test.mjs
corepack yarn workspace sequelize-guard-docs lint
corepack yarn workspace sequelize-guard-docs build
```

Packed-consumer checks install fresh dependencies and run native imports and strict declarations; registry access is required. To validate an existing archive use `RELEASE_TARBALL=/absolute/candidate.tgz RELEASE_VERSION=6.1.0 node --test scripts/test-package.mjs`. Repeat acceptance on both supported Node lines. See CI workflows for PostgreSQL 17, MySQL 8.4 and physical standby setup; dialect checks need isolated disposable databases. Never use production credentials or run a destructive sync against application data.

## Boundaries to preserve

Authentication and policy administration belong to the application. Request headers containing user IDs are not verified identity. Authorization denial returns false; database failures reject and must not be converted to an allowed result. Permissions are allow-only, exact-case action/resource tokens; unused `allow` data does not implement deny rules. Current writer reads do not make a later application operation atomic, nor invalidate an already running transaction's snapshot.

Finalize application model definitions/schema before constructing the guard. One guard owns a Sequelize connection's lifetime. With `sync:false`, awaiting `ready` does no database work. Production provisioning uses explicit migrations; static migrations never own a supplied UserModel or registered application holders. Explicit `guard.sync()` does forward force/alter to supplied users, so it is not a safe production migration substitute. Guard must never close the application's Sequelize connection. Preserve verified ownership receipts, refusal to adopt unrelated tables and conservative rollback.

Read [cloud handoff](docs/ai/feedback/2026-11-16-cloud-handoff.md), [release checklist](docs/ai/feedback/2026-11-16-release-readiness-checklist.md) and current continuation reports for release gates. The [maintenance review](docs/ai/feedback/2026-11-15-maintenance-review.md) is historical evidence, not a description of today's fixed behavior. Do not claim a checklist item complete from code or prose alone. Publication, tags and production migrations require separate explicit authorization.
