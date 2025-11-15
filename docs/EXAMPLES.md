# Examples

## Basic Usage

### Installation

```bash
npm install sequelize-guard sequelize
# or
yarn add sequelize-guard sequelize
```

### Setup

```typescript
import { Sequelize } from 'sequelize';
import { SequelizeGuard } from 'sequelize-guard';

// Initialize Sequelize
const sequelize = new Sequelize('sqlite::memory:', {
  logging: false,
});

// Initialize SequelizeGuard
const guard = new SequelizeGuard(sequelize, {
  sync: true, // Auto-create tables
  debug: false,
  userCache: true,
  userCacheTtl: 60,
});
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
const user = await guard.makeUser({
  name: 'John Doe',
  email: 'john@example.com',
});

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

```typescript
import { DataTypes } from 'sequelize';

// Define your custom User model
const MyUser = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  username: DataTypes.STRING,
  email: DataTypes.STRING,
  password: DataTypes.STRING,
});

// Pass it to SequelizeGuard
const guard = new SequelizeGuard(sequelize, {
  UserModel: MyUser,
  userPk: 'id', // your primary key
});

// Your User model now has all guard methods
const user = await MyUser.findOne({ where: { email: 'john@example.com' } });
await user.assignRole('admin');
const canEdit = await user.can('edit blog');
```

### Events

```typescript
// Listen to role creation
guard.onRolesCreated((roles) => {
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
```

### Migrations

```typescript
// In your migration file
import { migration } from 'sequelize-guard';

export async function up(queryInterface, Sequelize) {
  await migration.up(queryInterface, Sequelize, {
    prefix: 'guard_',
    timestamps: false,
    paranoid: false,
  });
}

export async function down(queryInterface, Sequelize) {
  await migration.down(queryInterface, Sequelize, {
    prefix: 'guard_',
  });
}
```

### TypeScript Support

Full TypeScript support with proper typing:

```typescript
import type {
  GuardOptions,
  GuardUserModel,
  GuardRoleModel,
  GuardPermissionModel,
  RoleCreationResult,
  AddPermsToRoleResult,
} from 'sequelize-guard';

const options: GuardOptions = {
  sync: true,
  userCache: true,
};

const guard = new SequelizeGuard(sequelize, options);

// All methods are properly typed
const result: RoleCreationResult = await guard.makeRole('admin');
const canEdit: boolean = await user.can('edit blog');
```

## Complete Example

```typescript
import { Sequelize } from 'sequelize';
import { SequelizeGuard } from 'sequelize-guard';

async function example() {
  // Setup
  const sequelize = new Sequelize('sqlite::memory:');
  const guard = new SequelizeGuard(sequelize, { sync: true });

  // Create roles
  await guard.makeRoles(['admin', 'editor', 'viewer']);

  // Set up permissions
  await guard.allow('admin', '*', '*'); // Admin can do everything
  await guard.allow('editor', ['view', 'edit', 'create'], 'blog');
  await guard.allow('viewer', 'view', '*'); // Viewer can view everything

  // Create users
  const admin = await guard.makeUser({});

  const editor = await guard.makeUser({});

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

  await sequelize.close();
}

example();
```
