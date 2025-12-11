<div align="center">

# Sequelize Guard

**A powerful, type-safe authorization library for Sequelize.js**

<p align="center">
  <a href="https://github.com/lotivo/sequelize-guard/actions/workflows/ci-test.yml">
    <img src="https://github.com/lotivo/sequelize-guard/actions/workflows/ci-test.yml/badge.svg" alt="CI">
  </a>
  <a href="https://coveralls.io/github/lotivo/sequelize-guard">
    <img src="https://coveralls.io/repos/github/lotivo/sequelize-guard/badge.svg" alt="Coverage">
  </a>
  <a href="https://www.npmjs.com/package/sequelize-guard">
    <img src="https://badge.fury.io/js/sequelize-guard.svg" alt="npm version">
  </a>
  <a href="https://opensource.org/licenses/MIT">
    <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT">
  </a>
</p>

<p align="center">
  <a href="https://sequelize-guard.js.org"><strong>📖 Documentation</strong></a> •
  <a href="https://www.npmjs.com/package/sequelize-guard"><strong>NPM Package</strong></a> •
  <a href="https://github.com/lotivo/sequelize-guard/issues"><strong>Report Bug</strong></a> •
  <a href="https://github.com/lotivo/sequelize-guard/issues"><strong>Request Feature</strong></a>
</p>

</div>

---

## About

SequelizeGuard is a comprehensive authorization library for Sequelize.js that provides a robust, performant, and easy-to-use role-based access control (RBAC) system. Built with TypeScript and modern tooling, it enables you to manage complex permission structures with a clean, fluent API.

## ✨ What's New in v6

Sequelize Guard v6 is a complete rewrite with major improvements:

- 🎯 **Full TypeScript Support** - Complete rewrite in TypeScript with full type definitions
- � **Sequelize 6 Compatible** - Updated to work with Sequelize v6.x
- � **ESM & CommonJS** - Dual package support for modern and legacy projects
- 🏗️ **Modern Tooling** - Built with Vite, tested with Vitest
- � **Better Type Safety** - Enhanced IntelliSense and compile-time checking
- ⚡ **99% Backward Compatible** - Minimal breaking changes from v5.x

> **Upgrading from v5?** Check out the [Migration Guide](https://sequelize-guard.js.org/migration/v6) for a smooth transition.

## Features

- 🚀 **Fast & Efficient** - Cache-based permission resolution for optimal performance
- 🎯 **Intuitive API** - Fluent, semantic API that reads like natural language
- 🔐 **Flexible RBAC** - Assign multiple roles and permissions to users
- 📊 **Event-Driven** - Listen for authorization events for logging and auditing
- 💾 **Smart Caching** - Configurable user permission caching
- 🛡️ **Safe Operations** - Built-in safeguards for role and permission deletions

## Installation

```bash
# npm
npm install sequelize-guard sequelize

# yarn
yarn add sequelize-guard sequelize

# pnpm
pnpm add sequelize-guard sequelize
```

**Requirements:**

- Node.js ≥ 20.19.0
- Sequelize ≥ 6.37.7

## Quick Start

```typescript
import { Sequelize } from 'sequelize';
import SequelizeGuard from 'sequelize-guard';

const sequelize = new Sequelize(/* config */);
const guard = new SequelizeGuard(sequelize);

// Assign roles and permissions
await user.assignRole('admin');
await guard.allow('admin', ['view', 'edit'], 'blog');

// Check permissions
const canEdit = await user.can('edit blog');
const isAdmin = await user.isA('admin');
```

> **Note:** Works with both TypeScript and JavaScript (ESM/CommonJS). See [documentation](https://sequelize-guard.js.org/getting-started) for JavaScript examples.

## Documentation

For comprehensive guides, API reference, and examples, visit our documentation:

**📖 [https://sequelize-guard.js.org](https://sequelize-guard.js.org)**

### Key Topics

- **[Getting Started](https://sequelize-guard.js.org/getting-started)** - Installation and basic setup
- **[API Reference](https://sequelize-guard.js.org/api)** - Complete API documentation
- **[TypeScript Support](https://sequelize-guard.js.org/typescript)** - Using with TypeScript
- **[Examples](https://sequelize-guard.js.org/examples)** - Real-world usage examples
- **[Blog](https://sequelize-guard.js.org/blogs)** - Articles and insights about the project

### Migration

- **[Migration Guide to v6](https://sequelize-guard.js.org/migration/upgrade-to-v6)** - Complete guide for upgrading to v6

### Core Concepts

#### Permission Checks

```typescript
// Check specific permission
await user.can('edit blog');

// Check wildcard permissions
await user.can('* blog'); // All actions on blog
await user.can('view *'); // View all resources
await user.can('*'); // Superadmin - all actions on all resources
```

#### Role Checks

```typescript
// Check single role
await user.isA('admin');
await user.isAn('editor');

// Check multiple roles
await user.isAnyOf(['admin', 'moderator']); // Has any of these roles
await user.isAllOf(['user', 'verified']); // Has all of these roles
```

#### Assigning Permissions

```typescript
// Fluent API
await guard
  .init()
  .allow('admin')
  .to(['view', 'edit', 'delete'])
  .on('blog')
  .commit();

// One-liner
await guard.allow('admin', ['view', 'edit'], 'blog');
```

For more details, visit the [full documentation](https://sequelize-guard.js.org/docs).

## Contributing

We love contributions! SequelizeGuard is open source and we welcome contributions of all kinds:

- 🐛 Bug fixes
- ✨ New features
- 📝 Documentation improvements
- ✅ Test coverage improvements
- 💡 Ideas and suggestions

```bash
# Clone the repository
git clone https://github.com/lotivo/sequelize-guard.git
cd sequelize-guard

# Install dependencies
yarn install

# Run tests
yarn test

# Build
yarn build
```

### Documentation

#### Generating API Documentation

API documentation is automatically generated from TypeScript source code:

```bash
# Generate API docs manually
yarn docs:generate
```

The API documentation is automatically updated after each release via GitHub Actions. See [scripts/README.md](scripts/README.md) for details.

### Reporting Issues

Found a bug or have a feature request? [Open an issue](https://github.com/lotivo/sequelize-guard/issues) with:

- Clear description
- Steps to reproduce (for bugs)
- Your environment (Node, Sequelize, sequelize-guard versions)

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

- 📖 **Documentation:** [https://sequelize-guard.js.org](https://sequelize-guard.js.org) (fallback: [https://sequelize-guard.vercel.app](https://sequelize-guard.vercel.app))
- 🐛 **Bug Reports:** [GitHub Issues](https://github.com/lotivo/sequelize-guard/issues)
- 💬 **Questions:** [GitHub Discussions](https://github.com/lotivo/sequelize-guard/discussions)

---

<div align="center">

Created by [Pankaj Vaghela](https://github.com/pankajvaghela) for Open Source Community.

If you find this project helpful, please consider giving it a ⭐️!

</div>
