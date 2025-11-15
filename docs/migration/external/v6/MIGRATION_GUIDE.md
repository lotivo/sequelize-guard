# Migration Guide: Upgrading to sequelize-guard v6

This guide will help you migrate your application from sequelize-guard v5.x to v6.x.

## Table of Contents

- [Overview](#overview)
- [Breaking Changes](#breaking-changes)
- [Migration Steps](#migration-steps)
- [Sequelize 6 Compatibility](#sequelize-6-compatibility)
- [TypeScript Support](#typescript-support)
- [API Changes](#api-changes)
- [Testing Changes](#testing-changes)
- [Troubleshooting](#troubleshooting)
- [Getting Help](#getting-help)

## Overview

Version 6.0 represents a major update to sequelize-guard with the following key improvements:

- **TypeScript Rewrite**: Full TypeScript support with complete type definitions
- **Sequelize 6 Compatibility**: Updated to work with Sequelize v6.x
- **Modern Tooling**: Built with Vite, tested with Vitest
- **Better Type Safety**: Improved IntelliSense and compile-time type checking
- **Maintained API Compatibility**: 99% backward compatible with v5.x

### Requirements

- **Node.js**: >=20.19.0
- **Sequelize**: ^6.37.7 or higher
- **TypeScript** (optional): ^5.0.0 or higher if using TypeScript

## Breaking Changes

### 1. Node.js Version Requirement

**v5.x:**

```json
"engines": {
  "node": ">=12.0.0"
}
```

**v6.x:**

```json
"engines": {
  "node": ">=20.19.0"
}
```

**Action Required:** Ensure your project runs on Node.js 20.19.0 or higher.

### 2. Sequelize 6 Peer Dependency

**v5.x:** Used Sequelize ^5.x

**v6.x:** Requires Sequelize ^6.37.7

**Action Required:** Upgrade Sequelize to v6.x first, then upgrade sequelize-guard.

### 3. ESM and CommonJS Exports

**v5.x:**

```js
// Only CommonJS
const SequelizeGuard = require('sequelize-guard');
```

**v6.x:**

```js
// CommonJS (still supported)
const SequelizeGuard = require('sequelize-guard');

// ESM (new)
import SequelizeGuard from 'sequelize-guard';
```

**Action Required:** No changes needed for CommonJS users. ESM users can now use native imports.

### 4. Type Definitions

**v5.x:** No official TypeScript definitions

**v6.x:** Full TypeScript definitions included

**Action Required:** If you had custom type definitions or `@types` packages, you can remove them.

## Migration Steps

### Step 1: Update Dependencies

First, update your `package.json`:

```bash
# Update sequelize to v6
npm install sequelize@^6.37.7

# Update sequelize-guard to v6
npm install sequelize-guard@^6.0.0

# Update your database driver if needed
npm install sqlite3@^5.1.7  # for SQLite
# or
npm install mysql2@^3.0.0   # for MySQL
# or
npm install pg@^8.0.0       # for PostgreSQL
```

### Step 2: Update Sequelize Configuration

If you're migrating from Sequelize 5 to 6, review the [Sequelize v6 migration guide](https://sequelize.org/docs/v6/other-topics/upgrade-to-v6/).

Key Sequelize 6 changes that affect sequelize-guard:

```js
// Sequelize 5
const Sequelize = require('sequelize');
const sequelize = new Sequelize('database', 'username', 'password', {
  dialect: 'mysql',
  operatorsAliases: false, // This option is removed in v6
});

// Sequelize 6
const { Sequelize } = require('sequelize');
const sequelize = new Sequelize('database', 'username', 'password', {
  dialect: 'mysql',
  // operatorsAliases removed
});
```

### Step 3: Update sequelize-guard Initialization

The initialization API remains the same:

```js
const SequelizeGuard = require('sequelize-guard');

// Your sequelize instance
const sequelize = new Sequelize(/* ... */);

// Initialize guard (same as v5)
const guard = new SequelizeGuard(sequelize, {
  prefix: 'guard_',
  sync: true,
  userModel: db.User, // Your custom user model
  userPk: 'id',
  // ... other options
});
```

**No changes required** for the initialization code.

### Step 4: Update Model Associations

If you have custom models that interact with guard models, ensure they use Sequelize 6 syntax:

**Sequelize 5:**

```js
User.hasMany(models.Post, {
  foreignKey: 'userId',
  as: 'posts',
});
```

**Sequelize 6:**

```js
// Same syntax, but ensure you're using Sequelize 6 types
User.hasMany(models.Post, {
  foreignKey: 'userId',
  as: 'posts',
});
```

### Step 5: Verify Migrations

The migration API remains the same:

```js
const SequelizeGuard = require('sequelize-guard');

module.exports = {
  up: (queryInterface, Sequelize) => {
    return SequelizeGuard.migration.up(queryInterface, Sequelize, options);
  },
  down: (queryInterface, Sequelize) => {
    return SequelizeGuard.migration.down(queryInterface, Sequelize, options);
  },
};
```

**No changes required** for migration files.

### Step 6: Test Your Application

Run your test suite to ensure everything works:

```bash
npm test
```

## Sequelize 6 Compatibility

### Model Definition Changes

If you're defining custom models that interact with sequelize-guard, update them to Sequelize 6 syntax:

**Sequelize 5:**

```js
const User = sequelize.define('User', {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  username: Sequelize.STRING,
  email: Sequelize.STRING,
});
```

**Sequelize 6:**

```js
const { DataTypes } = require('sequelize');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  username: DataTypes.STRING,
  email: DataTypes.STRING,
});
```

### Query Changes

Most queries remain the same, but some Sequelize 6 improvements you can leverage:

```js
// Find with include (same syntax)
const users = await User.findAll({
  include: [
    {
      association: 'roles',
      through: { attributes: [] },
    },
  ],
});

// Permission checks (unchanged)
const canEdit = await user.can('edit post');
const isAdmin = await user.isA('admin');
```

## TypeScript Support

### Basic TypeScript Setup

If you're using TypeScript, v6 provides full type definitions:

```typescript
import SequelizeGuard from 'sequelize-guard';
import { Sequelize } from 'sequelize';

const sequelize = new Sequelize(/* ... */);

const guard = new SequelizeGuard(sequelize, {
  prefix: 'guard_',
  sync: true,
  userModel: User, // TypeScript will validate this
  userPk: 'id',
});
```

### Type Definitions for User Model

Extend your User model with guard methods:

```typescript
import { Model, InferAttributes, InferCreationAttributes } from 'sequelize';
import type { GuardUserMethods } from 'sequelize-guard';

interface User
  extends Model<InferAttributes<User>, InferCreationAttributes<User>>,
    GuardUserMethods {
  id: number;
  username: string;
  email: string;
}
```

### Using Guard Methods with TypeScript

```typescript
// Type-safe permission checks
const canView: boolean = await user.can('view blog');
const canEdit: boolean = await user.can('edit blog');

// Type-safe role checks
const isAdmin: boolean = await user.isA('admin');
const isModerator: boolean = await user.isAnyOf(['admin', 'moderator']);

// Type-safe role assignment
await user.assignRole('editor');
await user.assignRoles(['editor', 'author']);
```

### Guard Control with TypeScript

```typescript
import type { GuardControlResult } from 'sequelize-guard';

const result: GuardControlResult = await guard
  .init()
  .allow('admin')
  .to(['view', 'edit'])
  .on('blog')
  .commit();

console.log(result.roles); // Type: GuardRoleModel[]
console.log(result.permissions); // Type: GuardPermissionModel[]
```

## API Changes

### No Breaking API Changes

All existing v5 APIs work in v6 without modification:

#### User Methods (Unchanged)

```js
// Permission-based authorization
await user.can('view blog');
await user.can('* blog');
await user.can('view *');
await user.can('*');

// Role-based authorization
await user.isA('admin');
await user.isAn('editor');
await user.isAnyOf(['admin', 'moderator']);
await user.isAllOf(['user', 'verified']);

// Role assignment
await user.assignRole('editor');
await user.assignRoles(['editor', 'author']);
await user.rmAssignedRoles(['author']);
```

#### GuardControl Methods (Unchanged)

```js
// Fluent API
await guard.init().allow('admin').to(['view', 'edit']).on('blog').commit();

// One-liner
await guard.allow('admin', ['view', 'edit'], 'blog');
```

#### SequelizeGuard Methods (Unchanged)

```js
// Permissions
await guard.createPerms({ action: 'view', resource: 'blog' });
await guard.createPermsBulk([
  /* ... */
]);
await guard.findPerms({ action: 'view', resource: 'blog' });

// Roles
await guard.makeRole('editor');
await guard.makeRoles(['editor', 'author']);
await guard.deleteRoles(['obsolete-role']);
await guard.allRoles();
await guard.getRole('admin');
await guard.findRoles(['admin', 'editor']);

// Associations
await guard.addPermsToRole('editor', [
  /* permissions */
]);
await guard.rmPermsFromRole('editor', [
  /* permissions */
]);
await guard.assignRoles(userId, ['editor']);
await guard.rmAssignedRoles(userId, ['author']);
```

### Enhanced Error Messages

v6 provides more detailed error messages with better stack traces for debugging.

### Event Handling (Unchanged)

All events work the same way:

```js
guard.on('onRolesCreated', (roles) => {
  console.log('Roles created:', roles);
});

guard.on('onRolesDeleted', (data) => {
  console.log('Roles deleted:', data);
});

guard.on('onPermsCreated', (perms) => {
  console.log('Permissions created:', perms);
});

guard.on('onPermsAddedToRole', (data) => {
  console.log('Permissions added:', data);
});

guard.on('onPermsRemovedFromRole', (data) => {
  console.log('Permissions removed:', data);
});
```

## Testing Changes

### Test Framework

v6 uses Vitest internally, but your application tests can use any framework.

### Testing with Jest

```js
const SequelizeGuard = require('sequelize-guard');
const { Sequelize } = require('sequelize');

describe('Authorization Tests', () => {
  let sequelize;
  let guard;
  let User;

  beforeAll(async () => {
    sequelize = new Sequelize('sqlite::memory:', { logging: false });

    guard = new SequelizeGuard(sequelize, {
      sync: true,
    });

    User = guard.getUser();
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  test('should assign role to user', async () => {
    const user = await User.create({ username: 'test' });
    await user.assignRole('admin');

    const isAdmin = await user.isA('admin');
    expect(isAdmin).toBe(true);
  });

  test('should check permissions', async () => {
    await guard.allow('admin', ['view', 'edit'], 'blog');
    const user = await User.create({ username: 'editor' });
    await user.assignRole('admin');

    const canView = await user.can('view blog');
    expect(canView).toBe(true);
  });
});
```

### Testing with Mocha

```js
const { expect } = require('chai');
const SequelizeGuard = require('sequelize-guard');
const { Sequelize } = require('sequelize');

describe('Authorization Tests', function () {
  let sequelize, guard, User;

  before(async function () {
    sequelize = new Sequelize('sqlite::memory:', { logging: false });
    guard = new SequelizeGuard(sequelize, { sync: true });
    User = guard.getUser();
    await sequelize.sync({ force: true });
  });

  after(async function () {
    await sequelize.close();
  });

  it('should assign role to user', async function () {
    const user = await User.create({ username: 'test' });
    await user.assignRole('admin');

    const isAdmin = await user.isA('admin');
    expect(isAdmin).to.be.true;
  });
});
```

## Troubleshooting

### Issue: Module Not Found

**Error:**

```
Error: Cannot find module 'sequelize-guard'
```

**Solution:**

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Issue: Sequelize Version Mismatch

**Error:**

```
Error: sequelize-guard requires Sequelize ^6.0.0
```

**Solution:**

```bash
# Update Sequelize first
npm install sequelize@^6.37.7
npm install sequelize-guard@^6.0.0
```

### Issue: TypeScript Errors with User Model

**Error:**

```typescript
Property 'can' does not exist on type 'User'
```

**Solution:**
Import and use the type augmentation:

```typescript
import SequelizeGuard from 'sequelize-guard';
import type { GuardUserMethods } from 'sequelize-guard';

interface UserInstance extends Model<any, any>, GuardUserMethods {
  id: number;
  username: string;
}
```

### Issue: Migration Fails

**Error:**

```
Error: Table 'guard_roles' already exists
```

**Solution:**
If you already have guard tables from v5, they should work with v6. Check the table structure matches:

```bash
# Check existing tables
sqlite3 database.db ".schema guard_roles"
```

If structure differs, create a new migration to alter tables, or drop and recreate them in development.

### Issue: Cache Not Working

**Error:**
User permissions are not being cached properly

**Solution:**
Verify cache options are set correctly:

```js
const guard = new SequelizeGuard(sequelize, {
  userCache: true, // Enable user cache
  userCacheTime: 60, // Cache for 60 seconds
});
```

### Issue: Events Not Firing

**Error:**
Event listeners are not being called

**Solution:**
Ensure you're listening to events before performing actions:

```js
// Set up listener first
guard.on('onRolesCreated', (roles) => {
  console.log('Created:', roles);
});

// Then perform action
await guard.makeRole('editor');
```

## Getting Help

### Resources

- **GitHub Issues**: [https://github.com/lotivo/sequelize-guard/issues](https://github.com/lotivo/sequelize-guard/issues)
- **Documentation**: [https://sequelizeguard.web.app](https://sequelizeguard.web.app)
- **Sequelize v6 Docs**: [https://sequelize.org/docs/v6/](https://sequelize.org/docs/v6/)

### Reporting Issues

When reporting issues, please include:

1. **Versions**:
   - Node.js version: `node --version`
   - Sequelize version: `npm list sequelize`
   - sequelize-guard version: `npm list sequelize-guard`

2. **Minimal reproduction**:
   - Code snippet that reproduces the issue
   - Database setup (SQLite, MySQL, PostgreSQL)
   - Error messages and stack traces

3. **Context**:
   - Are you migrating from v5 or starting fresh?
   - TypeScript or JavaScript?
   - What steps have you tried?

### Example Issue Report

```markdown
**Environment:**

- Node.js: v20.19.0
- Sequelize: 6.37.7
- sequelize-guard: 6.0.1
- Database: PostgreSQL 14
- TypeScript: Yes (5.9.3)

**Description:**
Getting TypeScript error when calling user.can()

**Code:**
\`\`\`typescript
const canEdit = await user.can('edit blog');
// Error: Property 'can' does not exist on type 'User'
\`\`\`

**What I've Tried:**

- Reinstalled dependencies
- Checked type definitions are in node_modules

**Question:**
How do I properly type my User model to include guard methods?
```

## Checklist for Migration

Use this checklist to ensure a smooth migration:

- [ ] Upgrade Node.js to >=20.19.0
- [ ] Upgrade Sequelize to ^6.37.7
- [ ] Review [Sequelize v6 migration guide](https://sequelize.org/docs/v6/other-topics/upgrade-to-v6/)
- [ ] Update database driver (sqlite3, mysql2, pg)
- [ ] Upgrade sequelize-guard to ^6.0.0
- [ ] Update model definitions to use Sequelize 6 syntax
- [ ] If using TypeScript, add type definitions for User model
- [ ] Run migrations (if using manual migrations)
- [ ] Test all authorization flows
- [ ] Test role assignment/removal
- [ ] Test permission checks
- [ ] Verify cache behavior
- [ ] Test event listeners
- [ ] Update application dependencies
- [ ] Update documentation
- [ ] Deploy to staging environment
- [ ] Monitor for issues
- [ ] Deploy to production

## Conclusion

Upgrading to sequelize-guard v6 is straightforward with minimal code changes required. The main effort is in upgrading to Sequelize 6 first, after which sequelize-guard v6 will work seamlessly with your existing code.

The addition of TypeScript support provides better developer experience without forcing TypeScript adoption—JavaScript users can continue using the library exactly as before.

If you encounter any issues not covered in this guide, please [open an issue](https://github.com/lotivo/sequelize-guard/issues) on GitHub.

Happy upgrading! 🚀
