# Security policy

Authentication belongs to your application. Resolve the actor from a verified session or credential verifier, then map that trusted principal to a persisted user or registered holder. Never authenticate an arbitrary `x-user-id`, body ID, query ID or unsigned JWT claim. Keep acting identity and target identity separate. Protect every policy mutation with dedicated administrative authorization, validate input and enforce tenant/object scope. Cookie-authenticated writes also require application CSRF protection.

Return 401 for absent/invalid identity, 403 for authenticated denial, and a sanitized 5xx for identity/database failures; never execute the protected action on those paths. Authorization database failures reject rather than returning a policy denial. Follow the [executable HTTP integration](https://github.com/lotivo/sequelize-guard/blob/master/examples/authorization.mjs), including its injected verified-session dependency and real Guard tests.

Wildcards are broad privileges: grant them only deliberately. Permissions are allow-only; the deprecated stored `allow` field does not implement deny rules. Soft-deleted users/holders lose access. Add application object/tenant checks where coarse role permissions are insufficient.

Authorization reads current writer-backed database state and never trusts the manual cache. A check already in flight or an older database transaction can see earlier state. A successful check and a subsequent business operation are not automatically atomic. Plan writer capacity and coordinate business consistency explicitly. Events are best-effort in-process notifications, not durable audit records. Applications own durable committed audit history and persisted expiry enforcement; timers do not provide reliable privilege expiration across restarts/workers.

[Report vulnerabilities privately](https://github.com/lotivo/sequelize-guard/security/advisories/new), with package/Node/Sequelize/dialect versions and a private minimal reproduction. Exclude secrets and customer data.

## Supported versions

Use the latest supported release and consult its changelog and package requirements. Older versions have no promised security backport commitment; report suspected issues privately even when your version is older.

Keep dialect drivers and application authentication dependencies patched. Review dependency advisories for affected code paths before applying updates; do not force incompatible major-version overrides.
