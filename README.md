# sequelize-acl

[![Build Status](https://travis-ci.com/lotivo/sequelize-acl.svg?branch=master)](https://travis-ci.com/lotivo/sequelize-acl) [![Coverage Status](https://coveralls.io/repos/github/lotivo/sequelize-acl/badge.svg?branch=master)](https://coveralls.io/github/lotivo/sequelize-acl?branch=master)

An ACL library for Sequelize.js

Not dependent on ACL or ACL node.

-------------

## Getting Started

### Basic Usage

#### 1. Create Sequelize Object

Create sequelize object with your database configuration.

For example we have used default Sequelize setup file for models.

```js
 //models/index.js

  let sequelize;
  if (config.use_env_variable) {
      sequelize = new Sequelize(process.env[config.use_env_variable], config);
  } else {
      sequelize = new Sequelize(config.database, config.username, config.password, config);
  }

```

#### 2. Initialize Sequelize-acl

Initialize SequelizeACL object **after** you have already initialized your models.

```js
var SequelizeAcl = require('@lotivo/sequelize-acl');

...
//initialize models
...

var acl = new SequelizeAcl(sequelize, options);
```

#### 3. Global Use

Add acl object as property to db object at the of the file.

```js
...

db.sequelize = sequelize;
db.Sequelize = Sequelize;
db.acl = acl;  // <---------- Add this line

module.exports = db;
```

### Expert Mode

#### Options

```js
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
    safeAclDeletes : true
}
```

- **tables** : *name of tables* - to be used for acl tables. (to be implemented).
- **prefix** : custom prefix for for all tables
- **primaryKey** : custom primary key for all acl tables (to be implemented) ,
- **timestamps** : *(bool | false)*, add timestamps to table
- **paranoid** : *(bool | false)*, soft deletes
- **sync**: *(bool | true)*, if set to true, database tables will be created without migrations
- **debug**: *(bool | false)*, print database queries to console.
- **userModel**: *(Sequelize Model | null)*, custom used model you want to use, instead of default User Model.
- **userPk** : *(string | 'id' )*, Primary key for User Model, in case your custom model has primaryKey other than 'id'.
- **safeAclDeletes** : *(bool | true)*, if set to true, role or permissions can't be deleted as long as they are associated with any other data. To remove you must break all other associations (to be tested).
