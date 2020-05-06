# sequelize-acl

[![Build Status](https://travis-ci.com/lotivo/sequelize-acl.svg?branch=master)](https://travis-ci.com/lotivo/sequelize-acl) [![Coverage Status](https://coveralls.io/repos/github/lotivo/sequelize-acl/badge.svg?branch=master)](https://coveralls.io/github/lotivo/sequelize-acl?branch=master)

An ACL library for Sequelize.js.

Fast, Easy, Roles & Permissions based Authorization.

- Fluent, easy to use semantic API.
- Assign multiple Roles to User.
- It is Super FAST, uses cache based permission resolution system.
- Listen for Events for anything ACL. Check [Events](#events)
- No dependency on ACL Node.

to know more see [documentation](https://lotivo-2020.web.app/).

Please provide your feedback : 

mail : vpankaj1998official@gmail.com
twitter : @impankajv1 

---

- [sequelize-acl](#sequelize-acl)
  - [Demo](#demo)
  - [Installation](#installation)
  - [Usage](#usage)
    - [Getting Started](#getting-started)
      - [Migrations](#migrations)
      - [1. Create Sequelize Object](#1-create-sequelize-object)
      - [2. Initialize Sequelize-acl](#2-initialize-sequelize-acl)
    - [Expert Mode](#expert-mode)
      - [Options](#options)
  - [Assigning Roles and Permissions](#assigning-roles-and-permissions)
    - [AclControl](#aclcontrol)
      - [1. init()](#1-init)
      - [2. allow()](#2-allow)
      - [3. to()](#3-to)
      - [4. on()](#4-on)
      - [5. commit()](#5-commit)
    - [User Model API](#user-model-api)
    - [SequelizeAcl API](#sequelizeacl-api)
  - [Authorization](#authorization)
    - [User API](#user-api)
      - [Permission based Authorization](#permission-based-authorization)
        - [user.can()](#usercan)
      - [Role based authorization](#role-based-authorization)
    - [Events](#events)
  - [Road map](#road-map)
  - [Influences](#influences)
  - [Alternative](#alternative)
  - [Contributions](#contributions)
  - [License](#license)

## Demo

After installation you can do stuff like

- **Setup**

```js
//Assign Role to a user.
user.assignRole('admin');

//assign permission to a role.
acl.init().allow('admin').to(['view', 'edit']).on('blog').commit();

//or if you like one liners
acl.allow('admin', ['view', 'edit'], 'blog');
```

- **Authorize**

by permission like

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

[NPM page](https://www.npmjs.com/package/@lotivo/sequelize-acl)

```bash
npm i @lotivo/sequelize-acl
```

or

```bash
yarn add @lotivo/sequelize-acl
```

Make sure, Sequelize is setup in your project.
If not, follow Sequelize [Getting Started](https://sequelize.org/master/manual/getting-started.html) first.

## Usage

### Getting Started

#### Migrations

sequelize-acl will automatically register and sync needed schemas.

Or you can use following code in migration file

```js
var SequelizeAcl = require('@lotivo/sequelize-acl');

module.exports = {
  up: (queryInterface, Sequelize) => {
    return SequelizeAcl.migration.up(queryInterface, Sequelize, options);
  },
  down: (queryInterface, Sequelize) => {
    return SequelizeAcl.migration.down(queryInterface, Sequelize, options);
  },
};
```

#### 1. Create Sequelize Object

Create sequelize object with your database configuration.

For example we have used default Sequelize setup file for models.

```js
//models/index.js

let sequelize;
if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  sequelize = new Sequelize( ... );
}
```

#### 2. Initialize Sequelize-acl

Initialize SequelizeACL object **after** you have already initialized your models.

```js
//Import library
var SequelizeAcl = require('@lotivo/sequelize-acl');

...
//initialize Sequelize
...

//initialize SequelizeAcl & add to db for global use
var acl = new SequelizeAcl(sequelize, options);

db.sequelize = sequelize;
db.Sequelize = Sequelize;
db.acl = acl;  // <---------- Add this line

module.exports = db;

```

Please Note:

- Make sure you pass same same options to migration and SequelizeAcl constructor,
- If you have your own User Model implemented, make sure you pass it during initialization,
  - not required for migrations.

### Expert Mode

#### Options

```js
//defaults
{
    tables : {
        meta: 'meta',
        parents: 'parents',
        permissions: 'permissions',
        resources: 'resources',
        roles: 'roles',
        users: 'users',
    },
    prefix : 'acl_',
    primaryKey : 'id',
    timestamps : false,
    paranoid : false,
    sync: true,
    debug: false,
    userModel: null,
    userPk : 'id', //User Primary Key
    safeAclDeletes : true,
    userCache: true,
    userCacheTime: 60, // 60
}
```

- **tables** : _name of tables_ - to be used for acl tables. (to be implemented).
- **prefix** : custom prefix for for all tables
- **primaryKey** : custom primary key for all acl tables (to be implemented) ,
- **timestamps** : _(bool | false)_, add timestamps to table
- **paranoid** : _(bool | false)_, soft deletes
- **sync**: _(bool | true)_, if set to true, database tables will be created without migrations
- **debug**: _(bool | false)_, print database queries to console.
- **userModel**: _(Sequelize Model | null)_, custom used model you want to use, instead of default User Model.
- **userPk** : _(string | 'id' )_, Primary key for User Model, in case your custom model has primaryKey other than 'id'.
- **safeAclDeletes** : _(bool | true)_, if set to true, role or permissions can't be deleted as long as they are associated with any other data. To remove you must break all other associations (to be tested).
- **userCache** : _(bool | true)_, roles of user will be cached, this will allow faster permission resolution and less database connections.
- **userCacheTime** : _(int | 60)_, time for which roles of user will be cached (in seconds), this number should be inversely proportional to your user traffic.

## Assigning Roles and Permissions

### AclControl

- AclControl is API layer over SequelizeAcl.
- API calls are chainable, which means you can call them in whichever order you prefer. [ exception : `commit()` ].

We are going to use same instance `acl` of SequelizeAcl we created during setup.

It's best to learn from examples. So here we will take a basic example.

```js
acl.init().allow('admin').to(['view', 'edit']).on('blog').commit();
```

(There's a one liner alternative available. Read below in SequelizeAPI)

Looks natural and easy right? Let's break the above example.

#### 1. init()

To initialize an AclControl call init() method on `acl` instance.
This function returns a brand new instance of [AclControl](#AclControl).

#### 2. allow()

parameter : **Role** (string)

- Pass name of role for which you are making control statement.
- Currently only supports one role at time. (Planning on allowing multiple roles soon).

**Note**: If you call this multiple times, whatever you passed most recently is taken into account.

#### 3. to()

parameter : **Action**(s) (string | array)

- accepts action as string or array of string.
- eg. view, edit, update, delete, wildcard (\*)

#### 4. on()

parameter : **Resource**(s) (string | array)

- pass name of resources as string or array of strings.
- eg. blog, post, image, article, wildcard(\*)

#### 5. commit()

Asynchronous call which saves all the data provided in database, using magic of SequelizeAcl and Sequelize.

- If permission is already created before, same permission is used.
- If Role is already created same role is assigned permission given.

**Returns** : object with properties roles, permission.
All the roles and permissions specified (created or old) by this AclControl statement are returned.

### User Model API

SequelizeAcl adds some api calls to User Model that you provide in options. So you can assign roles straight from your user object that is logged in.

- user.assignRole(role)
- user.assignRoles(roles)
- user.rmAssignedRoles(roles)

### SequelizeAcl API

for handling permissions

- createPerms(resource, actions, options)
- createPermsBulk({resource, actions}, options)
- findPerms(args) : find/search permission based on name, resource and action

for handling roles

- makeRole(role) : string
- makeRoles(roles) : array of strings
- deleteRoles(roles) : array of strings
- allRoles(roles) : get All roles
- getRole(roles) : get A role by name
- findRoles(args) : find/search roles based on name

for associations between user/role/permission

- allow(role, actions, resources) : AccessControl in one call
- addPermsToRole(role, actions, resources)
- rmPermsFromRole(role, actions, resources)
- assignRoles(user, roles) : UserModel, [string|array]
- rmAssignedRoles(user, roles)

For More information check SequelizeAcl [API Reference](https://lotivo-2020.web.app/api/index.html).

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

For More information check SequelizeAcl [API Reference](https://lotivo-2020.web.app/api/index.html).

### Events

You can listen to following events. They can be helpful for logging or updating user cache

- **onRolesCreated** : with created roles
- **onRolesDeleted** : with data of deleted roles
- **onPermsCreated** : with created permissions
- **onPermsAddedToRole** : with data after permissions added
- **onPermsRemovedFromRole** : with data after permissions are removed

## Road map

- Yet to make seeders, see branch [dev-seeder](https://github.com/lotivo/sequelize-acl/blob/dev-seeder/README.md) for progress.
- Implement "allow except" kind of permissions.
- Role priority, which will allow to do things like
  - `user.atleast('admin')`
  - `user.atmost('admin')`

## Influences

- Spaties's Laravel-permission, Authorization Library for Laravel.
- ACL for Node.js

## Alternative

- ACL is versatile library which has support for most ORMs.
  I actually tried to use that before writing this, but somehow wasn't feeling the power or freedom I wanted. But it is quite popular and mostly used.

## Contributions

For docs or tests or even code, feel free to send Pull Requests.

Feel free to create issues.

## License

The MIT License (MIT). Please see [License File](https://github.com/lotivo/sequelize-acl/blob/master/LICENSE) for more information.
