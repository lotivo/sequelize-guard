# Archived v5 to v6 migration note

**Historical archive.** The previous v5-to-v6 prose and compatibility examples have been retired because they do not describe the current package. They are not safe instructions for upgrading a published 6.0.2 database. No blanket backward-compatibility percentage is promised.

Use the [current published-6.0.2 to 6.1.0 upgrade and rollback guide](https://sequelize-guard.js.org/docs/migration/upgrade-to-v6), [compatibility policy](https://sequelize-guard.js.org/docs/guide/installation), [security contract](../../../../SECURITY.md) and [shared executable recipes](../../../../examples/README.md). The current tested Node lines are 22 (minimum 22.17.1) and 24, with Sequelize ^6.37.8. The 6.1.0 candidate includes deliberate schema and policy changes and remains unpublished until separate approval.

For older v5 deployments, first inventory the actual schema and exact package version and rehearse a separate migration on restored backups. The published-6.0.2 fixture does not establish a direct v5 upgrade path.
