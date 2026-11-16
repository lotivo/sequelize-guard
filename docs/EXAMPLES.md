# Executable examples

The canonical recipes are in [examples/](../examples/README.md), and the [web guide](https://sequelize-guard.js.org/docs/examples) links to these same files. The exact packed-package consumer checks execute them in an isolated installation.

- [ESM automatic initialization](../examples/basic.mjs)
- [CommonJS explicit initialization](../examples/basic.cjs)
- [Strict TypeScript custom application user](../examples/custom-user.ts)
- [Production migration and startup ordering](../examples/migrations.mjs)
- [Verified identity and protected Express administration](../examples/authorization.mjs)
- [Holders, inheritance, transactions and events](../examples/advanced.mjs)
- [Published 6.0.2 offline upgrade and destination rollback](../examples/upgrade.mjs)

Do not force-sync an existing application. Read the [upgrade guide](https://sequelize-guard.js.org/docs/migration/upgrade-to-v6) and [security contract](../SECURITY.md) before adapting a recipe. Candidate 6.1.0 publication is pending; fixes on this branch are not a released package.
