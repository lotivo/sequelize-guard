# Category C API, types, options, and ownership

> Category report from before the latest ownership and WIP fixes. Source branch commits e4238c3, e2de39f and 7b74a2a correspond to integration commits 9999975, 0ad4907 and 08a95f5. Earlier green results do not certify the assembled handoff.

Scope C1–C5 commits, in integration order: `e4238c3`, `e2de39f`, `7b74a2a`. The commits started from integrated root `3488618` with B's migration ownership fixes, F's public API feature implementation, and the 6.1.0 candidate version. C6 documentation belongs to category E.

## Options and initialization

- One guard owns a Sequelize instance for that instance's lifetime. A second guard on the same instance is rejected even with another prefix. Multiple connections are supported. Construction rejects occupied guard registry names, physical guard-table names mapped to another registered model, and conflicts with supplied user members or associations before registering guard-owned models.
- A supplied `UserModel` must be the initialized model registered on the same Sequelize instance. Pass the application model explicitly when it occupies the built-in `User` name. If a distinct supplied model is used while an unrelated application model is already registered as `User`, that application registration is preserved. Access the configured guard user model as `guard.models().GuardUser`.
- Guard-created model helpers are available without optional assertions. The constructor infers the supplied model's fields, key, and required creation attributes. `makeUser()` creates with empty attributes, so applications with mandatory fields use `guard.models().GuardUser.create(values)`. Generic helpers that take either built-in or custom guards can use `SequelizeGuard<Model>`.
- `primaryKey` accepts only `id` for the guard's own policy tables. Configure the supplied model's primary key with `userPk` when needed. The `role_hierarchy` suffix is reserved internally. The `meta` and `parents` suffixes and `userCache` flag remain deprecated and have no effect on policy. The manual user cache is available whether `userCache` is true or false.
- Constructor and static migration entry points share validation of unknown keys, option types, and table suffixes. An invalid value fails before database work or guard registration. `inheritExistingParents` is a boolean opt-in on upgrade. `sync:false` and `await guard.ready` perform no database work. Preserve the documented `sync({ force, alter })` behavior on an explicitly supplied user model. Registered role holder models remain application-owned.

## Builder, events, and return types

- Builder inputs are validated before changing the statement. An incomplete commit rejects and leaves the partial statement available. A complete commit consumes the statement before initiating the mutation, including when persistence rejects. Rebuild the statement before retrying. Repeated action and resource calls accumulate only within the current statement.
- Events carry the relevant role or permission model and return an unsubscribe function. They are best-effort after a successful guard-owned commit. Caller-supplied transaction mutations use savepoints and suppress guard events. Listener exceptions can produce warnings after a committed write.
- `createPerms` and `createPermsBulk` return models by default and plain data with `json:true`. `makeRoles` defaults to plain data when its options are omitted or undefined. `makeRoles(roles, {})` and `json:false` yield models. A non-literal boolean produces a model-or-data return type.
- `getUserRoles` and `getHolderRoles` return plain active direct-role data. `user.roles()` reads the same active direct roles on the writer and returns role models. It no longer attaches the join-row payload. `user.getRoles()` remains the ordinary Sequelize association. Authorization never reads guard caches.
- A missing role returns `null` through `getRole` and as the `role` field of a missing-role permission removal. Bulk membership assignment returns `{ assigned: number }`. Hierarchy parent names are strings or `null`.
- Cached roles are models. Cached permissions are plain data. Legacy permission records can have a null name. Role-cache snapshots have no background timer. A manually requested user cache retains NodeCache expiry events and one sweeper across resets. Keep its reference and call `close()` when finished. The caller owns and closes the Sequelize connection.

## Compatibility and verification

- Package release candidate `6.1.0` deliberately tracks the Sequelize major. The version decision includes compatibility changes. Remove blanket backward-compatibility language and show safe upgrade steps.
- Declare tested Node lines 22 and 24 and the minimum 22.17.1. Tests exercised 22.17.1 and 24.15.0. Sequelize peer and runtime range is `^6.37.8`. The release's dialect matrix covers SQLite, PostgreSQL 17, and MySQL 8.4. The package ships native Node ESM and CommonJS and strict TypeScript 5.9 declaration coverage for NodeNext import/require and Bundler resolution.
- Node 24.15.0 validated 215 SQLite tests, strict source typecheck, source ESLint, package build, and all seven exact 6.1.0 tarball tests. Pack checks assert real ESM and CJS behavior with hierarchy/holders, strict positive and negative type cases for the custom model and public API return types in all three compiler modes, release contents, and manifest version.
- Node 22.17.1 repeated the 215 SQLite tests, strict source typecheck, package lint, build, and all seven exact 6.1.0 tarball tests. Yarn 1.22.22 frozen offline install reused the cached SQLite arm64 binary. The Node 22 verification ran with Nx caching disabled.
- C code can be reverted without schema or data changes of its own. PostgreSQL, MySQL, physical replica, independent clean consumer installation, and final combined acceptance are covered by the release orchestrator and the other owning categories.
