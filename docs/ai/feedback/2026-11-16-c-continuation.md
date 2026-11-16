# Category C continuation — immutable bindings and safe sync

Schema-defining Guard options remain immutable (`prefix`, `tables`, `primaryKey`,
`timestamps`, `paranoid`, `UserModel`, `userPk`, and `roleHolders`), including the
`guard.options` reference. Caller option maps are copied. Runtime policy/debug/cache
options remain mutable; application Sequelize instances and model classes are not frozen.

The guard now captures its Sequelize schema defaults and bound model metadata after
registration. Changes to schema routing, model registration, physical tables, primary
keys, attribute fields/types, timestamp/paranoid behavior, foreign keys, referential
actions, uniqueness or indexes reject before explicit synchronization, linked
authorization queries, and policy mutations. Registered holder models are included.
Default functions are compared by identity and never executed while capturing bindings.
Applications must finalize model definitions and schema routing before constructing
their guard. Use a new Sequelize connection/guard when changing those definitions.

Force sync now uses the migration ownership-verified down/provision lifecycle instead
of retaining a completed receipt across drops. The supplied UserModel still receives
explicit force/alter options. It is synced after owned junctions are dropped and before
they are provisioned again. Registered holder application tables remain application-owned.
The migration owner repaired SQLite schema-qualified physical index creation.

Added regressions cover live schema/default-schema/delimiter drift; user table, key,
paranoid and registry drift; reinitialized holder definitions; same-table/key
reinitialization with changed foreign-key action/index; and supplied-user force/alter.
Assertions verify zero database queries after drift, including destructive sync calls,
authorization, memberships and permission creation.

These changes complete the outstanding C ownership follow-up, subject to the combined
release's independent review and dialect/consumer acceptance. No schema migration is
needed specifically for the in-memory binding validation. Compatibility prose remains
owned by category E; preserve the earlier API lifecycle report's return-type, zero-work
`ready`, builder-consumption and manual-cache lifetime contracts.
