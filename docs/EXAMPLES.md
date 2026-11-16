# Examples

The canonical recipes are in [examples/](../examples/README.md), and the [web guide](https://sequelize-guard.js.org/docs/examples) links to these same files. The exact packed-package consumer checks execute them in an isolated installation.

- [ESM automatic initialization](../examples/basic.mjs)
- [CommonJS explicit initialization](../examples/basic.cjs)
- [Strict TypeScript custom application user](../examples/custom-user.ts)
- [Production migration and startup ordering](../examples/migrations.mjs)
- [Verified identity and protected Express administration](../examples/authorization.mjs)
- [Holders, inheritance, transactions and events](../examples/advanced.mjs)
- [Published 6.0.2 offline upgrade and destination rollback](../examples/upgrade.mjs)

Do not force-sync an existing application. Read the [upgrade guide](https://sequelize-guard.js.org/docs/migration/upgrade-to-v6-1) and [security contract](../SECURITY.md) before adapting a recipe.

## Basic Usage

### Installation

```bash
npm install sequelize-guard sequelize@^6.37.8 sqlite3
# or
yarn add sequelize-guard sequelize@^6.37.8 sqlite3
```

### Setup

```typescript
import { Sequelize } from 'sequelize';
import { SequelizeGuard } from 'sequelize-guard';

// Initialize Sequelize
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: ':memory:',
  logging: false,
});

// Initialize SequelizeGuard
const guard = new SequelizeGuard(sequelize, {
  sync: true, // Initialize a new disposable database
  debug: false,
});
await guard.ready;
```

### Creating Roles

```typescript
// Create a single role
const { role, created } = await guard.makeRole('admin');

// Create multiple roles
const roles = await guard.makeRoles(['admin', 'moderator', 'editor']);

// Find roles
const allRoles = await guard.allRoles();
const adminRole = await guard.getRole('admin');
```

### Creating Permissions

```typescript
// Create permissions for a resource
await guard.createPerms('blog', ['view', 'edit', 'delete']);

// Create permissions in bulk
await guard.createPermsBulk([
  { resource: 'blog', actions: ['view', 'edit'], name: 'blog_management' },
  { resource: 'post', actions: ['view'] },
  { resource: 'comment', actions: ['view', 'delete'] },
]);
```

### Assigning Permissions to Roles

```typescript
// Using fluent API
await guard
  .init()
  .allow('admin')
  .to(['view', 'edit', 'delete'])
  .on('blog')
  .commit();

// Using one-liner
await guard.allow('moderator', ['view', 'edit'], 'comment');
```

### Working with Users

```typescript
// Create a user
const user = await guard.makeUser();

// Assign roles to user
await guard.assignRole(user, 'admin');
await guard.assignRoles(user, ['moderator', 'editor']);

// Remove roles
await guard.rmAssignedRoles(user, ['editor']);
```

### User Model Methods

```typescript
// After guard is initialized, User models have these methods:

// Assign roles
await user.assignRole('admin');
await user.assignRoles(['moderator', 'editor']);

// Check permissions
const canEdit = await user.can('edit blog'); // true/false
const cannotDelete = await user.cant('delete blog'); // true/false

// Check roles
const isAdmin = await user.isA('admin'); // true/false
const isModerator = await user.isAn('moderator'); // true/false
const hasAnyRole = await user.isAnyOf(['admin', 'editor']); // true/false
const hasAllRoles = await user.isAllOf(['admin', 'moderator']); // true/false

// Get all roles
const roles = await user.roles();

// Remove roles
await user.rmAssignedRoles(['editor']);
```

### Permission Wildcards

```typescript
// Allow all actions on a resource
await guard.allow('admin', '*', 'blog');

// Allow action on all resources
await guard.allow('analyst', 'view', '*');

// Allow all actions on all resources (superadmin)
await guard.allow('superadmin', '*', '*');

// Check with wildcards
await user.can('* blog'); // All actions on blog
await user.can('view *'); // View all resources
await user.can('*'); // All actions on all resources
```

### Using with Custom User Model

Configure the model when you construct the application's guard. Apply the
application and Guard migrations before running the example.

```typescript
import { DataTypes } from 'sequelize';

// Define the application model before constructing the guard.
const Account = sequelize.define('Account', {
  accountKey: { type: DataTypes.STRING, primaryKey: true },
  email: { type: DataTypes.STRING, allowNull: false },
});

const guard = new SequelizeGuard(sequelize, {
  UserModel: Account,
  userPk: 'accountKey',
  sync: false,
});
await guard.ready;

const user = await guard.models().GuardUser.create({
  accountKey: 'acct-1',
  email: 'john@example.com',
});
await user.assignRole('admin');
const canEdit = await user.can('edit blog');
```

### Events

Guard-owned mutations emit after commit. Supplying a caller transaction
suppresses Guard events for that operation. Use application storage for a
durable audit trail.

```typescript
// Listen to role creation
const unsubscribe = guard.onRolesCreated((roles) => {
  console.log('New roles created:', roles);
});

// Listen to role deletion
guard.onRolesDeleted((roles) => {
  console.log('Roles deleted:', roles);
});

// Listen to permissions added to role
guard.onPermsAddedToRole((role) => {
  console.log('Permissions added to role:', role.name);
});

// Listen to permissions removed from role
guard.onPermsRemovedFromRole((role) => {
  console.log('Permissions removed from role:', role.name);
});

// Listen to permission creation
guard.onPermsCreated((perms) => {
  console.log('New permissions created:', perms);
});

// Remove the role-creation listener when finished.
unsubscribe();
```

### Migrations

```typescript
import { migration } from 'sequelize-guard';
import type { Sequelize } from 'sequelize';

// Use these same options at worker startup.
const options = {
  prefix: 'guard_',
  timestamps: false,
  paranoid: false,
  sync: false,
};

export async function up(sequelize: Sequelize) {
  await migration.up(sequelize.getQueryInterface(), sequelize, options);
}

export async function down(sequelize: Sequelize) {
  await migration.down(sequelize.getQueryInterface(), sequelize, options);
}
```

Run application migrations first and run the Guard migration before starting
workers. Match schema options in both directions, including any supplied user
model and registered role holders. See the [migration recipe](../examples/migrations.mjs).

### TypeScript Support

Full TypeScript support with proper typing:

```typescript
import type { GuardOptions, RoleCreationResult } from 'sequelize-guard';

const options: GuardOptions = { sync: true };
const guard = new SequelizeGuard(sequelize, options);
await guard.ready;

const result: RoleCreationResult = await guard.makeRole('admin');
const user = await guard.makeUser();
const canEdit: boolean = await user.can('edit blog');
```

## Complete Example

```typescript
import { Sequelize } from 'sequelize';
import { SequelizeGuard } from 'sequelize-guard';

async function example() {
  // Setup
  const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: ':memory:',
    logging: false,
  });
  try {
    const guard = new SequelizeGuard(sequelize, { sync: true });
    await guard.ready;

    // Create roles
    await guard.makeRoles(['admin', 'editor', 'viewer']);

    // Set up permissions
    await guard.allow('admin', '*', '*'); // Admin can do everything
    await guard.allow('editor', ['view', 'edit', 'create'], 'blog');
    await guard.allow('viewer', 'view', '*'); // Viewer can view everything

    // Create users
    const admin = await guard.makeUser();
    const editor = await guard.makeUser();

    // Assign roles
    await admin.assignRole('admin');
    await editor.assignRole('editor');

    // Check permissions
    console.log(await admin.can('delete blog')); // true
    console.log(await editor.can('delete blog')); // false
    console.log(await editor.can('edit blog')); // true

    // Check roles
    console.log(await admin.isA('admin')); // true
    console.log(await editor.isAnyOf(['admin', 'editor'])); // true
  } finally {
    await sequelize.close();
  }
}

await example();
```
