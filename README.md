# Sequelize Guard

Role-based authorization for Sequelize 6: allow-only grants, single-parent role inheritance, registered application role holders, native ESM/CommonJS and TypeScript declarations.

**6.1.0 candidate — release approval is pending.** Install an approved published version; do not assume this branch is on npm.

```sh
npm install sequelize-guard sequelize@^6.37.8
# Also install your dialect driver (for example sqlite3, pg or mysql2).
```

The 6.1.0 candidate targets Node 22 (minimum 22.17.1) and 24, Sequelize `^6.37.8`, SQLite, PostgreSQL 17 and MySQL 8.4. Install the dialect driver your application needs. Sequelize 7 and other dialects are outside this tested contract. Native ESM and CommonJS are shipped, with strict TypeScript 5.9 consumer coverage for NodeNext import/require and Bundler resolution.

6.1.0 deliberately keeps the package major aligned with Sequelize 6. It changes policy, schema and lifecycle contracts: its minor version is **not a drop-in compatibility promise**. Published 6.0.2 is immutable; candidate fixes are not a published security release. See [upgrade instructions](https://sequelize-guard.js.org/docs/migration/upgrade-to-v6).

Start with the [ESM recipe](examples/basic.mjs), [CommonJS manual setup](examples/basic.cjs), [custom user TypeScript recipe](examples/custom-user.ts), [production migration recipe](examples/migrations.mjs) and [verified identity HTTP integration](examples/authorization.mjs). These are shared executable fixtures checked against the exact npm tarball.

`new SequelizeGuard(sequelize)` starts automatic initialization; await `guard.ready` before work and stop startup if it rejects. For a new disposable database, [basic.mjs](examples/basic.mjs) demonstrates that path.

For explicit setup, construct with `{ sync:false }`, await `ready` (this performs **zero database work**), then await `guard.sync()`. `sync()` initializes/provisions; it is not an upgrade strategy. Retrying initialization is explicit through `sync()`. Never use `force` or `alter` as a production migration substitute. Explicit `guard.sync({ force, alter })` also passes these options to a supplied `UserModel`; it can change application user data. Registered holder models are never synced or dropped by Guard.

Production deployment runs application migrations first, then the matching static `migration.up(queryInterface, sequelize, options)` once, and only then starts workers with the same options and `sync:false`. Await `ready`; reject startup or requests on database failures. Static migrations do not own a supplied user table. [migrations.mjs](examples/migrations.mjs) is the canonical runnable recipe.

`guard.init()` is a fluent **policy builder**, not database initialization: `await guard.init().allow('reader').to('read').on('article').commit()`. An incomplete statement remains editable after rejection. A completed statement is consumed before persistence, including on failure; rebuild it before retrying.

Read the [guide](https://sequelize-guard.js.org/docs/guide), [upgrade/rollback guide](https://sequelize-guard.js.org/docs/migration/upgrade-to-v6), [API reference](https://sequelize-guard.js.org/docs/api), [security contract](https://github.com/lotivo/sequelize-guard/blob/fix/pre-release-hardening/SECURITY.md), and [6.1.0 changelog](https://github.com/lotivo/sequelize-guard/blob/fix/pre-release-hardening/CHANGELOG.md). Authorization always reads the writer; manual caches are not authorization authority. Authentication, tenant/object checks, durable audits and expiry enforcement belong to the application.

Development: Node 22/24 and Yarn 1.22.22; run `yarn install --frozen-lockfile`, `yarn lint`, `yarn typecheck`, `yarn test`, `yarn build`, `yarn test:package`, `yarn docs:generate`, and `node scripts/check-docs.mjs`. See [script guidance](https://github.com/lotivo/sequelize-guard/blob/fix/pre-release-hardening/scripts/README.md) for exact-archive checks.

[Report a vulnerability privately](https://github.com/lotivo/sequelize-guard/security/advisories/new). MIT licensed; see [LICENSE](LICENSE).

For coding assistants, consult the portable [integration skill](skills/sequelize-guard/SKILL.md), [AI integration guide](https://sequelize-guard.js.org/docs/ai-integration), and [discovery index](https://sequelize-guard.js.org/llms.txt). Discovery behavior depends on the agent tool; installing the package does not automatically enable every assistant.
