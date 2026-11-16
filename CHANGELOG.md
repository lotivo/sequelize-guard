# Changelog

## 6.1.0 (candidate)

This release retains the Sequelize 6 major alignment and includes deliberate compatibility changes. It is not published by this branch. Read the [offline upgrade and rollback guide](https://sequelize-guard.js.org/docs/migration/upgrade-to-v6) before deployment.

- Authorize from current writer-backed state; enforce exact action/resource grammar, canonical action sets and individual-action revocation. Malformed checks deny and infrastructure failures reject.
- Add atomic policy mutations, caller savepoints, commit-aware best-effort events, deletion safeguards, bulk memberships, single-parent inherited permissions and registered model role holders with isolated foreign-key junctions. Direct role checks remain direct.
- Align model/migration constraints, keys, timestamps and custom table names. Add ownership receipts, conservative rollback/external-reference refusal and offline 6.0.2 copies to wholly distinct prefixes. MySQL interrupted DDL can require manual recovery.
- Add explicit awaitable `sync(options)` and stricter model/option binding, one Guard per connection, observable startup errors, custom user inference and accurate return declarations. `sync:false`/`ready` perform no database work. Completed builder statements are consumed on failure. Caller transactions suppress built-in events.
- Remove stale authorization-cache assumptions: manual user cache ownership is explicit; role snapshots have no timer. No automatic durable auditing, deny precedence or privilege expiry is provided.
- Require Node >=22.17.1 (tested 22/24) and Sequelize ^6.37.8. Ship native ESM/CommonJS and strict NodeNext/Bundler declarations. Remove obsolete ESDoc tooling and refresh dependencies with assessed residual exposures.
- Replace guides with shared executable recipes, verified identity/admin checks, security reporting, exact-revision API generation and exact-archive consumer/release checks.

Published 6.0.2 already had `ready`. Existing schemas require the documented migration procedure; never force-sync production data. Explicit sync force/alter still reaches a supplied UserModel. Rollback after divergent writes requires an application recovery plan and matching backup.
