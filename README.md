# Sequelize Guard

**A powerful, fast, and flexible authorization library for Sequelize.js**

<div align="left">

[![CI](https://github.com/lotivo/sequelize-guard/actions/workflows/ci-test.yml/badge.svg)](https://github.com/lotivo/sequelize-guard/actions/workflows/ci-test.yml)
[![Coverage Status](https://coveralls.io/repos/github/lotivo/sequelize-guard/badge.svg)](https://coveralls.io/github/lotivo/sequelize-guard)
[![npm version](https://badge.fury.io/js/sequelize-guard.svg)](https://www.npmjs.com/package/sequelize-guard)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[Documentation](https://lotivo.github.io/sequelize-guard/) • [NPM Package](https://www.npmjs.com/package/sequelize-guard) • [Report Bug](https://github.com/lotivo/sequelize-guard/issues) • [Request Feature](https://github.com/lotivo/sequelize-guard/issues)

</div>

---

## Table of Contents

- [Sequelize Guard](#sequelize-guard)
  - [Table of Contents](#table-of-contents)
  - [About](#about)
  - [Features](#features)
  - [Installation](#installation)
  - [Demo](#demo)
  - [Installation](#installation-1)
  - [Usage](#usage)
    - [Getting Started](#getting-started)
    - [Migrations](#migrations)
    - [Initialization](#initialization)
      - [Step 1: Create Sequelize Object](#step-1-create-sequelize-object)
      - [Step 2: Initialize SequelizeGuard](#step-2-initialize-sequelizeguard)
    - [Expert Mode](#expert-mode)
      - [Options](#options)
  - [Assigning Roles and Permissions](#assigning-roles-and-permissions)
    - [GuardControl API](#guardcontrol-api)
    - [User Model API](#user-model-api)
    - [SequelizeGuard API](#sequelizeguard-api)
  - [Authorization](#authorization)
    - [User API](#user-api)
      - [Permission based Authorization](#permission-based-authorization)
        - [user.can()](#usercan)
      - [Role based authorization](#role-based-authorization)
    - [Events](#events)
  - [API Reference](#api-reference)
  - [Examples](#examples)
  - [Contributing](#contributing)
    - [How to Contribute](#how-to-contribute)
    - [Development Guidelines](#development-guidelines)
    - [Reporting Issues](#reporting-issues)
    - [Code of Conduct](#code-of-conduct)
  - [Release Process](#release-process)
    - [For Maintainers](#for-maintainers)
      - [Creating a Release](#creating-a-release)
    - [Versioning Strategy](#versioning-strategy)
    - [NPM Distribution Tags](#npm-distribution-tags)
    - [Troubleshooting Releases](#troubleshooting-releases)
  - [Roadmap](#roadmap)
    - [Current Focus](#current-focus)
    - [Future Plans](#future-plans)
  - [License](#license)
  - [Acknowledgments](#acknowledgments)
    - [Influences](#influences)
    - [Alternatives](#alternatives)
  - [Support](#support)

## About

SequelizeGuard is a comprehensive authorization library for Sequelize.js that provides a robust, performant, and easy-to-use role-based access control (RBAC) system. It enables you to manage complex permission structures with a clean, fluent API.

## Features

- 🚀 **Fast & Efficient** - Cache-based permission resolution for optimal performance
- 🎯 **Intuitive API** - Fluent, semantic API that reads like natural language
- 🔐 **Flexible RBAC** - Assign multiple roles and permissions to users
- 📊 **Event-Driven** - Listen for authorization events for logging and auditing
- 🔌 **Zero Dependencies** - No dependency on Node-ACL or other external libraries
- 💾 **Smart Caching** - Configurable user permission caching
- 🛡️ **Safe Operations** - Built-in safeguards for role and permission deletions
- 📦 **TypeScript Support** - Full TypeScript definitions included

## Installation

Install with yarn:

```bash
yarn add sequelize-guard
```

Or with npm:

```bash
npm install sequelize-guard
```

**Prerequisites:** Make sure Sequelize is set up in your project. If not, follow the [Sequelize Getting Started Guide](https://sequelize.org/master/manual/getting-started.html).

## Demo

After installation you can do stuff like

- **Setup**

```js
//Assign Role to a user.
user.assignRole('admin');

//assign permission to a role.
guard.init().allow('admin').to(['view', 'edit']).on('blog').commit();

//or if you like one liners
guard.allow('admin', ['view', 'edit'], 'blog');
```

- **Authorize**

by permission

```js
//view blog
user.can('view blog');

//All Actions on blog
user.can('* blog');

//view All Resources, eg. analyst
user.can('view *');

//All Action on All Resources, superadmin
user.can('*');
```

or by Role

```js
//check if user is editor
user.isA('editor');

//use isAn where you require
user.isAn('admin');

//use isAnyOf to check either of roles
user.isAnyOf(['admin', 'moderator']);
```

## Installation

[NPM page](https://www.npmjs.com/package/sequelize-guard)

```bash
npm i sequelize-guard
```

or

```bash
yarn add sequelize-guard
```

Make sure, Sequelize is setup in your project.
If not, follow Sequelize [Getting Started](https://sequelize.org/master/manual/getting-started.html) first.

## Usage

### Getting Started

### Migrations

sequelize-guard will automatically register and sync needed schemas.

Or you can use following code in a migration file

```js
var SequelizeGuard = require('sequelize-guard');

module.exports = {
  up: (queryInterface, Sequelize) => {
    return SequelizeGuard.migration.up(queryInterface, Sequelize, options);
  },
  down: (queryInterface, Sequelize) => {
    return SequelizeGuard.migration.down(queryInterface, Sequelize, options);
  },
};
```

### Initialization

#### Step 1: Create Sequelize Object

Create a Sequelize object with your database configuration.

```js
// models/index.js

let sequelize;
if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  sequelize = new Sequelize( ... );
}
```

#### Step 2: Initialize SequelizeGuard

Initialize SequelizeGuard **after** initializing your models.

```js
// Import library
const SequelizeGuard = require('sequelize-guard');

// ... initialize Sequelize ...

// Initialize SequelizeGuard and add to db for global use
const guard = new SequelizeGuard(sequelize, options);

db.sequelize = sequelize;
db.Sequelize = Sequelize;
db.guard = guard; // <-- Add this line

module.exports = db;
```

**Important Notes:**

- Pass the same options to both migration and SequelizeGuard constructor
- If you have a custom User Model, pass it during initialization (not required for migrations)
- SequelizeGuard must be initialized after your models are defined

### Expert Mode

#### Options

```js
//defaults
{
    prefix : 'guard_',
    primaryKey : 'id',
    timestamps : false,
    paranoid : false,
    sync: true,
    debug: false,
    userModel: null,
    userPk : 'id', //User Primary Key
    safeGuardDeletes : true,
    userCache: true,
    userCacheTime: 60, // 60
}
```

- **prefix** : custom prefix for for all tables
- **primaryKey** : custom primary key for all guard tables (to be implemented) ,
- **timestamps** : _(bool | false)_, add timestamps to table
- **paranoid** : _(bool | false)_, soft deletes
- **sync**: _(bool | true)_, if set to true, database tables will be created without migrations
- **debug**: _(bool | false)_, print database queries to console.
- **userModel**: _(Sequelize Model | null)_, custom used model you want to use, instead of default User Model.
- **userPk** : _(string | 'id' )_, Primary key for User Model, in case your custom model has primaryKey other than 'id'.
- **safeGuardDeletes** : _(bool | true)_, if set to true, role or permissions can't be deleted as long as they are associated with any other data. To remove you must break all other associations (to be tested).
- **userCache** : _(bool | true)_, roles of user will be cached, this will allow faster permission resolution and less database connections.
- **userCacheTime** : _(int | 60)_, time for which roles of user will be cached (in seconds), this number should be inversely proportional to your user traffic.

## Assigning Roles and Permissions

### GuardControl API

- GuardControl is API layer over SequelizeGuard.
- Makes API calls chainable, which means you can call them in whichever order you prefer. [ exception : `commit()` ].

We are going to use same instance `guard` of SequelizeGuard we created during setup.

It's best to learn from examples. So here we will take a basic example.

```js
guard.init().allow('admin').to(['view', 'edit']).on('blog').commit();
```

(There's a one liner alternative available. Read below in SequelizeAPI)

Looks natural and easy right? Let's break the above example.

**1. init()**

To initialize an GuardControl call init() method on `guard` instance.
This function returns a brand new instance of [GuardControl](#GuardControl).

**2. allow()**

parameter : **Role** (string)

- Pass name of role for which you are making control statement.
- Currently only supports one role at time. (Planning on allowing multiple roles soon).

**Note**: If you call this multiple times, whatever you passed most recently is considered.

**3. to()**

parameter : **Action**(s) (string | array)

- accepts action as string or array of string.
- eg. view, edit, update, delete, wildcard (\*)

**4. on()**

parameter : **Resource**(s) (string | array)

- pass name of resources as string or array of strings.
- eg. blog, post, image, article, wildcard(\*)

**5. commit()**

Asynchronous call which saves all the data provided in database, using magic of SequelizeGuard and Sequelize.

- If permission is already created before, same permission is used.
- If Role is already created same role is assigned permission given.

**Returns** : object with properties roles, permission.
All the roles and permissions specified (created or old) by this GuardControl statement are returned.

### User Model API

SequelizeGuard adds some api calls to User Model that you provide in options. So you can assign roles straight from your user object that is logged in.

- user.assignRole
- user.assignRoles
- user.rmAssignedRoles

### SequelizeGuard API

for handling permissions

- createPerms
- createPermsBulk
- findPerms

**for handling roles**

- makeRole
- makeRoles
- deleteRoles
- allRoles
- getRole
- findRoles

**for associations between user/role/permission**

- allow : GuardControl in one line
- addPermsToRole
- rmPermsFromRole
- assignRoles
- rmAssignedRoles

For More information check SequelizeGuard [API Reference](https://sequelizeguard.web.app/api).

## Authorization

### User API

#### Permission based Authorization

##### user.can()

parameter : 'action resource' (string)
returns : bool

Pass permission you are testing for as follows. returns true if allowed.

```js
//view blogs
user.can('view blogs');

//All Actions on blogs
user.can('* blogs');

//view All Resources, eg. analyst
user.can('view *');

//All Action on All Resources, superadmin
user.can('*');
```

#### Role based authorization

You can use following methods to have perform role based authorization.

- user.isAllOf(roles)
- user.isAnyOf(roles)
- user.isA(role)
- user.isAn(role)

For More information check SequelizeGuard [API Reference](https://sequelizeguard.web.app/api/).

### Events

You can listen to following events. They can be helpful for logging or updating user cache

- **onRolesCreated** : with created roles
- **onRolesDeleted** : with data of deleted roles
- **onPermsCreated** : with created permissions
- **onPermsAddedToRole** : with data after permissions added
- **onPermsRemovedFromRole** : with data after permissions are removed

## API Reference

For detailed API documentation, visit [SequelizeGuard API Reference](https://sequelizeguard.web.app/api).

## Examples

For more examples and use cases, check out the [Examples Documentation](docs/EXAMPLES.md).

## Contributing

We love contributions! SequelizeGuard is open source and we welcome contributions of all kinds:

- 🐛 Bug fixes
- ✨ New features
- 📝 Documentation improvements
- ✅ Test coverage improvements
- 💡 Ideas and suggestions

### How to Contribute

1. **Fork the Repository**

   Fork the project to your own GitHub account.

2. **Clone Your Fork**

   ```bash
   git clone https://github.com/YOUR_USERNAME/sequelize-guard.git
   cd sequelize-guard
   ```

3. **Create a Branch**

   Create a new branch for your changes:

   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

4. **Install Dependencies**

   ```bash
   yarn install
   ```

5. **Make Your Changes**
   - Write clean, maintainable code
   - Follow the existing code style
   - Add tests for new features
   - Update documentation as needed

6. **Run Tests**

   Ensure all tests pass:

   ```bash
   yarn test
   ```

   Run tests with coverage:

   ```bash
   yarn test:coverage
   ```

7. **Run Linting**

   ```bash
   yarn lint
   ```

8. **Commit Your Changes**

   Write clear, descriptive commit messages:

   ```bash
   git add .
   git commit -m "feat: add new permission caching strategy"
   ```

   We follow [Conventional Commits](https://www.conventionalcommits.org/) format:
   - `feat:` for new features
   - `fix:` for bug fixes
   - `docs:` for documentation changes
   - `test:` for test additions or changes
   - `refactor:` for code refactoring
   - `chore:` for maintenance tasks

9. **Push to Your Fork**

   ```bash
   git push origin feature/your-feature-name
   ```

10. **Open a Pull Request**
    - Go to the original repository on GitHub
    - Click "New Pull Request"
    - Select your fork and branch
    - Provide a clear description of your changes
    - Reference any related issues

### Development Guidelines

- **Code Style:** Follow the existing code style and conventions
- **Tests:** Add tests for all new features and bug fixes
- **Documentation:** Update README and docs for new features
- **Commits:** Use clear, descriptive commit messages
- **Pull Requests:** Keep PRs focused on a single feature or fix

### Reporting Issues

Found a bug? Have a feature request?

1. Check if the issue already exists in [GitHub Issues](https://github.com/lotivo/sequelize-guard/issues)
2. If not, create a new issue with:
   - Clear, descriptive title
   - Detailed description of the problem or feature
   - Steps to reproduce (for bugs)
   - Expected vs actual behavior
   - Your environment (Node version, Sequelize version, etc.)

### Code of Conduct

This project adheres to a code of conduct. By participating, you are expected to:

- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on what is best for the community
- Show empathy towards other community members

## Release Process

SequelizeGuard uses an automated release process through GitHub Actions.

### For Maintainers

#### Creating a Release

1. **Ensure All Changes Are Merged**

   Make sure all intended changes are merged into the `dev-v6` branch (or your target branch).

2. **Update Version and Changelog**
   - Update any necessary documentation
   - Ensure all tests pass: `yarn test`
   - Ensure linting passes: `yarn lint`

3. **Create and Push a Tag**

   Create a version tag following semantic versioning:

   ```bash
   # For a regular release
   git tag v1.2.3
   git push origin v1.2.3

   # For a pre-release (beta, alpha, rc)
   git tag v1.2.3-beta.1
   git push origin v1.2.3-beta.1
   ```

4. **Automated Release Pipeline**

   When you push a tag starting with `v`, GitHub Actions automatically:
   - ✅ Runs linting checks
   - ✅ Runs the full test suite with coverage
   - 📝 Updates `package.json` version to match the tag
   - 🏗️ Builds the library
   - 📦 Publishes to NPM with provenance (`npm publish --access public`)
     - NPM automatically tags pre-releases based on version string (e.g., `v1.0.0-beta.1`)
   - 🎉 Creates a GitHub Release (draft) with auto-generated release notes

5. **Finalize the GitHub Release**
   - Go to [GitHub Releases](https://github.com/lotivo/sequelize-guard/releases)
   - Find the draft release created by the action
   - Edit and enhance the release notes if needed
   - Publish the release

### Versioning Strategy

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (`v2.0.0`): Breaking changes
- **MINOR** (`v1.1.0`): New features, backward compatible
- **PATCH** (`v1.0.1`): Bug fixes, backward compatible
- **PRE-RELEASE** (`v1.0.0-beta.1`): Beta, alpha, or release candidates

### NPM Distribution Tags

NPM automatically assigns distribution tags based on the version string in your tag:

- `latest`: Stable releases without pre-release identifiers (e.g., `v1.2.3`)
- `beta`, `alpha`, `rc`: Pre-release versions are automatically tagged (e.g., `v1.0.0-beta.1` gets the `beta` tag)

### Troubleshooting Releases

If a release fails:

1. Check the [GitHub Actions](https://github.com/lotivo/sequelize-guard/actions) log
2. Common issues:
   - Test failures: Fix tests before releasing
   - Lint errors: Run `yarn lint` and fix issues
   - NPM authentication: Verify NPM token in repository secrets
3. Delete the tag if needed and recreate after fixing:
   ```bash
   git tag -d v1.2.3
   git push origin :refs/tags/v1.2.3
   ```

## Roadmap

### Current Focus

- 🌱 Improve seeders (see [dev-seeder branch](https://github.com/lotivo/sequelize-guard/blob/dev-seeder/README.md))
- 🚫 Implement "allow except" permissions
- 📊 Role priority system:
  - `user.atleast('admin')`
  - `user.atmost('admin')`

### Future Plans

- Enhanced caching strategies
- GraphQL support
- More granular permission scoping
- Performance optimizations
- Extended event system

See [open issues](https://github.com/lotivo/sequelize-guard/issues) for a full list of proposed features and known issues.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

### Influences

- [**Spatie's Laravel-permission**](https://github.com/spatie/laravel-permission) - Authorization library for Laravel
- [**Node-ACL**](https://github.com/OptimalBits/node_acl) - Access Control List for Node.js

### Alternatives

- [**Node-ACL**](https://github.com/OptimalBits/node_acl) - A versatile library with support for most ORMs
- [**AccessControl**](https://github.com/onury/accesscontrol) - Role and attribute-based access control
- [**CASL**](https://casl.js.org/) - Isomorphic authorization library

## Support

Need help? Here's how to get support:

- 📖 **Documentation:** [https://sequelizeguard.web.app](https://sequelizeguard.web.app)
- 🐛 **Bug Reports:** [GitHub Issues](https://github.com/lotivo/sequelize-guard/issues)
- 💬 **Questions:** [GitHub Discussions](https://github.com/lotivo/sequelize-guard/discussions)

---

<div align="center">

Made with ❤️ by [Pankaj Vaghela](https://github.com/pankajvaghela)

If you find this project helpful, please consider giving it a ⭐️!

</div>
