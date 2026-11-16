---
name: sequelize-guard
description: Use when integrating Sequelize Guard into an existing application, adding role or permission checks, configuring custom user models or migrations, or diagnosing revoked access.
compatibility: Sequelize ^6.37.8, Node 22.17.1 or Node 24; ESM, CommonJS and strict TypeScript. Requires access to the application's installed dependencies and test commands.
metadata:
  package: sequelize-guard
---

# Integrate Sequelize Guard

Preserve the application's verified identity and database ownership while adding executable authorization checks. Inspect the installed declarations and package version before applying these recipes.

## Inspect the application first

1. Identify its package manager, module format, Sequelize instance, model definitions, migration runner, authenticated-principal source and existing test command. Reuse these rather than creating another connection or authentication system. Finalize models and schema routing before constructing one guard per Sequelize instance lifetime.
2. From the **application directory**, run `npm ls sequelize-guard sequelize` (or the package manager equivalent). For the resolved version and portable recipe paths, run `node /absolute/path/to/this/skill/references/installed-package.mjs`. [The detector](references/installed-package.mjs) resolves from the current application directory and reads the manifest on disk; it does not import a blocked `sequelize-guard/package.json` export. It also works when this skill was copied out of node_modules. Investigate resolution/version mismatches before changing policy or schema.
3. Use the returned `examples` directory as the canonical source. Read the recipe and adapt its application integration points; the SQLite databases and issued test sessions are disposable fixtures, not production services. Copy examples outside node_modules to run them with `sequelize`, `sqlite3`, `express@5.1.0` (HTTP recipe), TypeScript and Node types installed as needed. Do not modify the installed package.

| Task | Canonical installed recipe |
| --- | --- |
| ESM grant, assignment, denial, action/membership revocation | `examples/basic.mjs` |
| CommonJS, explicit sync, fluent builder | `examples/basic.cjs` |
| Custom string user key and required fields | `examples/custom-user.ts` |
| Holders, inheritance and transaction/event boundaries | `examples/advanced.mjs` |
| Offline upgrade from published 6.0.2 | `examples/upgrade.mjs` |
| Migration before worker startup | `examples/migrations.mjs` |
| Verified identity, admin authorization, HTTP failures | `examples/authorization.mjs` |

## Integrate using real public APIs

Import `{ SequelizeGuard }` from `sequelize-guard` (CommonJS: `require('sequelize-guard')`). Use `new SequelizeGuard(sequelize, options)` and always await `guard.ready`, handling rejection before serving requests. Default construction provisions tables; use `{ sync: false }` in an existing application. In that mode `ready` does **zero database work**: deployment migrations must already have run. `guard.sync()` is explicit provisioning, whereas `guard.init()` creates a fluent permission builder; neither replaces readiness handling.

Use `await guard.allow('reader', 'read', 'article')` in a trusted bootstrap/admin operation, `await guard.assignRole(user, 'reader')`, then `await guard.userCan(user, 'read article')` or the extended `await user.can('read article')`. Use `guard.rmPermsFromRole('reader', 'read', 'article')` and `guard.rmAssignedRoles(user, ['reader'])` for revocation. There are no `guard.users`, `guard.roles`, `guard.permissions` or `guard.cache` services. Read installed declarations for additional APIs and return types rather than guessing.

For supplied users, define the model before construction and pass `{ UserModel: Account, userPk: 'uid', sync: false }` consistently to guard and migration configuration. Create users with `guard.models().GuardUser.create({ uid, ...requiredFields })`; `makeUser()` cannot provide mandatory application attributes. Preserve string/UUID key types and the application's existing table. Static migrations own only Guard tables, never supplied users or registered holders.

## Keep authentication and administration explicit

Obtain the actor from the application's maintained session/token verifier. Do not trust `x-user-id`, request-body IDs, unsigned token claims or query parameters as the acting identity. Authorize policy mutations separately (for example `guard.userCan(actor, 'manage policy')`); ordinary readers cannot grant themselves roles. Do not expose arbitrary grant/role input without application validation and administrative authorization. The authorization recipe injects a verifier; its opaque test session strings are not an authentication implementation.

A false result is a denial (usually HTTP 403 after verified authentication). Missing/invalid authentication is usually 401. Readiness/database errors reject; handle them through the application's error path (for example 503), never return success or treat infrastructure failure as proof of a permission decision. Malformed checks deny; malformed stored grants are ignored. Tokens are case-sensitive, whitespace-free, and `*` is only a whole token. Permissions are allow-only; the legacy `allow` field is not deny precedence.

## Preserve schema and consistency boundaries

Run `migration.up(queryInterface, sequelize, matchingOptions)` from the existing deployment migration runner before workers start. The migrations recipe includes `down` only to test disposable-fixture cleanup; production rollback requires a reviewed backup/recovery plan. Never recommend force-sync, alter-sync, dropping tables or rewriting ownership receipts for production. Explicit `guard.sync({ force: true })` also affects a supplied UserModel. Registered application holders remain application-owned. For upgrades from 6.0.2 use the documented offline distinct-prefix upgrade and validate/backup legacy data; do not assume starting the new package will migrate old tables.

Authorization reads current writer state, not local policy cache. After a committed revocation, a new check must deny. An older transaction/in-flight check can retain its snapshot, and a check is not atomic with a later business write. Investigate transaction boundaries, wrong identity/connection/schema, inherited or wildcard grants and actual commit status when diagnosing retained access. Do not clear caches as an access-control repair. Child roles inherit parent permissions; direct role checks remain direct membership. Caller-owned transactions suppress built-in events; events are not a durable audit log.

## Verify the adapted application

Use its normal runtime, typecheck and test tools. Assert all of these against actual persistence:

- Denial before grant, allowance after assignment, denial after action revocation and after membership revocation; malformed checks deny.
- Unauthenticated and forged identity fail; a reader cannot mutate policy and the failed request leaves policy unchanged.
- Failed initialization prevents serving protected traffic; database failure follows the error path, never a successful response.
- Custom users retain required attributes/types and survive Guard migration rollback; existing application tables/data remain intact.

Report installed package/Node versions, changed files, executed checks and any unverified database or deployment steps. Passing Markdown checks alone does not establish that an integration works. The application owns closing its Sequelize connection; callers close any explicitly created user caches.
