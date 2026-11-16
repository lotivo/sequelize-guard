# Canonical executable recipes

These files are the single source for the human docs and exact-tarball consumer checks in `scripts/test-package.mjs`. They are copied into a fresh consumer with the exact archive installed; they do not import workspace source.

- `basic.mjs`: ESM automatic initialization and action/membership revocation.
- `basic.cjs`: native CommonJS and explicit sync; fluent builder.
- `custom-user.ts`: strict TypeScript custom string identity with mandatory fields and application-user preservation on rollback.
- `migrations.mjs`: separate production migration/startup ordering.
- `advanced.mjs`: separate holder identities, inherited grant revocation, caller transaction rollback/events and application-model preservation.
- `upgrade.mjs`: actual published 6.0.2 custom-user offline migration to a distinct namespace.
- `authorization.mjs`: injected verified-session dependency, real Express/HTTP/Guard persistence and denial/error/admin/revocation assertions.

Install sequelize, sqlite3, express@5.1.0 and the exact sequelize-guard archive in an isolated directory, copy these files there, run each .mjs/.cjs with Node, and compile/run custom-user.ts with strict TypeScript NodeNext. `RELEASE_TARBALL=/absolute/candidate.tgz RELEASE_VERSION=6.1.0 node --test scripts/test-package.mjs` automates consumer validation. The upgrade fixture additionally needs the published alias `sequelize-guard-previous@npm:sequelize-guard@6.0.2`; its database uses a unique temporary directory. The HTTP fixture's issued opaque sessions are a test identity provider; supply your maintained application credential verifier in production. Never use its session strings as production credentials.
