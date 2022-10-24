// Importing mocha and chai
const mocha = require('mocha');
const chai = require('chai');
var expect = chai.expect;
var assert = chai.assert;

var schemas = require('../lib/migrations/guard-schema').schemas;

var SequelizeGuard = require('../lib/index');

exports.init = function () {
  describe('SequelizeGuard init custom config', function () {
    it('should be initialized when user passed', function (done) {
      let GuardUser = this.seqMem1.define('User', schemas['users'], {
        tableName: `guard_users`,
      });
      let seqGuard = new SequelizeGuard(this.seqMem1, {
        sync: false,
        debug: false,
        timestamps: true,
        paranoid: true,
        UserModel: GuardUser,
      });

      if (seqGuard) {
        this.__proto__.seqMem1 = null;
        done();
      }
    });

    it('should be initialized with options 2', function (done) {
      let seqGuard = new SequelizeGuard(this.seqMem2, {
        sync: true,
        debug: true,
        timestamps: true,
        paranoid: false,
      });

      if (seqGuard) {
        this.__proto__.seqMem2 = null;
        done();
      }
    });
  });
};

exports.Constructor = function () {
  // Group of tests using describe
  describe('setup', function () {
    let migration = [],
      seeds = [];
    let queryInterfaceStub = {
      createTable: function (tableName, schema) {
        migration.push(tableName);
      },
      dropTable: function (tableName, schema) {
        migration.push(tableName);
      },
      bulkInsert: async function (tableName, data) {
        seeds.push(tableName);
      },
      bulkDelete: async function (tableName, data) {
        seeds.push(tableName);
      },
    };

    it('properly runs up migration', function () {
      migration = [];
      // ['guard_actions', 'guard_resources', 'guard_permissions', 'guard_roles', 'guard_role_user', 'guard_role_permission'  ];
      let expected = SequelizeGuard.migration.tables.map((t) => 'guard_' + t);

      SequelizeGuard.migration.up(queryInterfaceStub, this.guard.sequelize);

      assert.deepEqual(migration, expected);
    });

    it('properly runs up migration with options', function () {
      migration = [];
      // ['guard_actions', 'guard_resources', 'guard_permissions', 'guard_roles', 'guard_role_user', 'guard_role_permission'  ];
      let expected = SequelizeGuard.migration.tables.map((t) => 'guard_' + t);

      SequelizeGuard.migration.up(queryInterfaceStub, this.guard.sequelize, {
        prefix: 'guard_',
        timestamps: true,
        paranoid: true,
      });

      assert.deepEqual(migration, expected);
    });

    it('properly runs down migrations', function () {
      migration = [];
      // ['guard_actions', 'guard_resources', 'guard_permissions', 'guard_roles', 'guard_role_user', 'guard_role_permission'  ];
      let expected = SequelizeGuard.migration.tables.map((t) => 'guard_' + t);

      SequelizeGuard.migration.down(queryInterfaceStub, this.guard.sequelize);
      assert.deepEqual(migration, expected);
    });
    it('properly runs down migrations with options', function () {
      migration = [];
      // ['guard_actions', 'guard_resources', 'guard_permissions', 'guard_roles', 'guard_role_user', 'guard_role_permission'  ];
      let expected = SequelizeGuard.migration.tables.map((t) => 'guard_' + t);

      SequelizeGuard.migration.down(queryInterfaceStub, this.guard.sequelize, {
        prefix: 'guard_',
      });
      assert.deepEqual(migration, expected);
    });

    it('properly runs up seeder', function () {
      seeds = [];
      let expected = ['guard_roles', 'guard_permissions'];

      return SequelizeGuard.seeder
        .up(queryInterfaceStub, this.guard.sequelize)
        .then(() => {
          assert.deepEqual(seeds, expected);
        });
    });
    it('properly runs up seeder with options', function () {
      seeds = [];
      let expected = ['guard_roles', 'guard_permissions'];

      return SequelizeGuard.seeder
        .up(queryInterfaceStub, this.guard.sequelize, { timestamps: true })
        .then(() => {
          assert.deepEqual(seeds, expected);
        });
    });

    it('properly runs down seeder', function () {
      seeds = [];
      let expected = ['guard_roles', 'guard_permissions'];

      return SequelizeGuard.seeder
        .down(queryInterfaceStub, this.guard.sequelize)
        .then(() => {
          assert.deepEqual(seeds, expected);
        });
    });

    it('should return all guard models, i.e. 6 models', function () {
      expect(Object.keys(this.guard.models()).length).to.equal(6);
    });
  });
};

exports.Permissions = function () {
  describe('Permissions', function () {
    it('should create permission single action', function (done) {
      this.guard
        .createPerms('blog', 'view')
        .then(function (perms) {
          expect(perms[0].name).to.equal('blog:[view]');
          done();
        })
        .catch((err) => {
          assert(!err);
          done();
        });
    });
    it('should create permission multiple actions', function (done) {
      this.guard
        .createPerms('blog', ['view', 'edit'])
        .then(function (perms) {
          expect(perms[0].name).to.equal('blog:[view,edit]');
          done();
        })
        .catch((err) => {
          assert(!err);
          done();
        });
    });
    it('should not create duplicate permission', function (done) {
      this.guard
        .createPerms('blog', ['view', 'edit'])
        .then(function (perms) {
          expect(perms.length).to.equal(0);
          done();
        })
        .catch((err) => {
          assert(!err);
          done();
        });
    });

    it('should create permission with "multiple resources" return created', function (done) {
      this.guard
        .createPerms(['blog', 'users'], ['view', 'edit'], {
          names: ['', 'blog_main'],
          json: true,
        })
        .then(function (perms) {
          expect(perms.length).to.equal(1);
          done();
        })
        .catch((err) => {
          assert(!err);
          done();
        });
    });

    it('should create permission with "multiple resources" return all', function (done) {
      this.guard
        .createPerms(['blog', 'users', 'admin'], ['view', 'edit'], {
          names: ['', 'blog_main'],
          all: true,
        })
        .then(function (perms) {
          expect(perms.length).to.equal(3);
          done();
        })
        .catch((err) => {
          assert(!err);
          done();
        });
    });

    it('should create permission in bulk with "multiple resources" with options, return created, ', function () {
      return this.guard
        .createPermsBulk(
          [
            {
              resource: 'blog',
              actions: 'view',
            },
            {
              name: 'blog_manage',
              resource: 'blog',
              actions: ['view', 'edit', 'update', 'create'],
            },
          ],
          {
            json: true,
          }
        )
        .then(function (perms) {
          expect(perms.length).to.equal(1);
        })
        .catch((err) => {
          assert(!err);
        });
    });

    it('should create permission in bulk with "multiple resources" without options, return created', function () {
      return this.guard
        .createPermsBulk([
          {
            resource: 'blog',
            actions: 'view',
          },
          {
            name: 'gallery_manage',
            resource: 'gallery',
            actions: ['view', 'edit', 'update', 'create'],
          },
        ])
        .then(function (perms) {
          expect(perms.length).to.equal(1);
        })
        .catch((err) => {
          assert(!err);
        });
    });

    describe('Find Permissions', () => {
      it('should find perms by resource action in search mode', async function () {
        return this.guard
          .findPerms({ resource: 'blog', action: 'view', search: true })
          .then((perms) => {
            expect(perms).to.be.an('array');
          });
      });
      it('should find perms by name in search mode', async function () {
        return this.guard
          .findPerms({ name: 'blog', search: true })
          .then((perms) => {
            expect(perms).to.be.an('array');
          });
      });
      it('should find perms by resource action by exact match', async function () {
        return this.guard
          .findPerms({ resource: 'blog', action: 'view' })
          .then((perms) => {
            expect(perms).to.be.an('array');
          });
      });
      it('should find perms by name by exact match', async function () {
        return this.guard.findPerms({ name: 'blog:[view]' }).then((perms) => {
          expect(perms).to.be.an('array');
        });
      });
      it('should return all permissions when no args ', async function () {
        return this.guard.findPerms().then((perms) => {
          expect(perms).to.be.an('array');
        });
      });
    });
  });
};

exports.Roles = function () {
  describe('Roles', function () {
    // describe('Create Role(s)', function () {
    it('single: should create role by string', function (done) {
      this.guard
        .makeRole('admin')
        .then(function (data) {
          expect(data.role.dataValues.name).to.equal('admin');
          done();
        })
        .catch((err) => {
          assert(!err);
          done();
        });
    });
    it('single: should create role by object', function (done) {
      this.guard
        .makeRole({ name: 'admin2' })
        .then(function (data) {
          expect(data.role.dataValues.name).to.equal('admin2');
          done();
        })
        .catch((err) => {
          assert(!err);
          done();
        });
    });

    it('single: should not create for empty string', function (done) {
      this.guard
        .makeRole('')
        .then(function (data) {
          expect(!data);
          done();
        })
        .catch((err) => {
          assert(err);
          done();
        });
    });

    it('multiple: should not create duplicate, return created roles', async function () {
      return this.guard
        .makeRoles([
          'admin',
          'moderator',
          { name: 'user', description: 'A basic user' },
        ])
        .then(function (data) {
          expect(data.length).to.equal(2);
        })
        .catch((err) => {
          assert(!err);
        });
    });

    it('multiple: should not create duplicate, return all roles', async function () {
      return this.guard
        .makeRoles(
          ['admin', 'analyst', { name: 'user', description: 'A basic user' }],
          { all: true, json: true }
        )
        .then(function (data) {
          expect(data.length).to.equal(3);
        })
        .catch((err) => {
          assert(!err);
        });
    });
    // });

    // describe('View Roles', () => {
    it('should return all roles', function () {
      this.guard.allRoles().then((roles) => {
        expect(roles.length).to.equal(5);
      });
    });
    it('should return find roles by name ', function () {
      this.guard.findRoles({ name: 'admin' }).then((roles) => {
        expect(roles[0].name).to.equal('admin');
      });
    });
    it('should return find roles by names, exact match', function () {
      this.guard
        .findRoles({ names: ['admin', 'analyst', 'admin5'] })
        .then((roles) => {
          expect(roles.length).to.equal(2);
        });
    });
    it('should return find roles by names, search mode', function () {
      this.guard
        .findRoles({ names: ['admin', 'mod'], search: true })
        .then((roles) => {
          expect(roles.length).to.equal(3);
        });
    });

    it('should return find roles by names with parents', function () {
      this.guard
        .findRoles({
          names: ['admin', 'mod'],
          search: true,
          withParent: true,
        })
        .then((roles) => {
          //TODO: when parent added modify this test case
          expect(roles.length).to.equal(3);
        });
    });
    it('should return all roles by default when name, names not passed', function () {
      this.guard.findRoles().then((roles) => {
        expect(roles.length).to.equal(5);
      });
    });
    it('should return all roles by default when names array size is 0 ', function () {
      this.guard.findRoles({ names: [] }).then((roles) => {
        expect(roles.length).to.equal(5);
      });
    });

    it('should return role data by name ', function () {
      this.guard.getRole('admin').then((role) => {
        expect(role.name).to.equal('admin');
      });
    });
    it('should return null if role not found ', function () {
      this.guard.getRole('adminNotFound').then((role) => {
        expect(role).to.equal(null);
      });
    });
    // });

    // describe('Delete Role(s)', function () {
    it('single: should delete role', function (done) {
      this.guard
        .deleteRoles('admin')
        .then(function (data) {
          expect(data).to.equal(1);
          done();
        })
        .catch((err) => {
          assert(!err);
          done();
        });
    });

    it('multiple: should delete roles', function (done) {
      this.guard
        .deleteRoles(['admin', { name: 'moderator' }])
        .then(function (data) {
          expect(data).to.equal(1);
          done();
        })
        .catch((err) => {
          assert(!err);
          done();
        });
    });

    it('should return 0 if role not found : delete role', function (done) {
      this.guard.deleteRoles('admin3').then(function (data) {
        expect(data).to.equal(0);
        done();
      });
    });
    // });

    it('should throw error for array as argument for role', function (done) {
      this.guard
        .deleteRoles([3, 'analyst', { name: 'moderator' }])
        .then(function (data) {
          assert(!data);
          done();
        })
        .catch((err) => {
          assert(err);
          done();
        });
    });

    it('should add permission to role', function () {
      return this.guard
        .addPermsToRole('analyst', ['view'], ['*', 'resAnalyst'])
        .then((data) => {
          expect(data.permissions.length).to.equal(2);
          expect(data.role.name).to.equal('analyst');
        });
    });
    it('should remove permissions from role', function () {
      return this.guard
        .rmPermsFromRole('analyst', ['view'], ['resAnalyst'])
        .then((data) => {
          expect(data.permissions.length).to.equal(1);
          expect(data.role.name).to.equal('analyst');
        })
        .catch((e) => console.log(e));
    });
    it('should remove permissions from role', function () {
      return this.guard
        .rmPermsFromRole('analyst2', ['view'], ['resAnalyst'])
        .then((data) => {
          expect(data.permissions.length).to.equal(0);
          expect(data.role.name).to.equal('analyst2');
        })
        .catch((e) => console.log(e));
    });
  });
};

exports.Users = function () {
  describe('Users', function () {
    it('should create user', function (done) {
      this.guard
        .makeUser({ name: 'SuperAdmin', email: 'superadmin@test.com' })
        .then(function (data) {
          expect(data.dataValues.name).to.equal('SuperAdmin');
          done();
        })
        .catch((err) => {
          assert(!err);
          done();
        });
    });

    it('should create user 2', function (done) {
      let users = [
        { name: 'SomeAdmin', email: 'someAdmin@test.com' },
        { name: 'flux editor', email: 'editor@test.com' },
        { name: 'User 1', email: 'myuser@test.com' },
      ];
      this.guard._models.GuardUser.bulkCreate(users)
        .then(function (data) {
          expect(data.length).to.equal(3);
          done();
        })
        .catch((err) => {
          assert(!err);
          done();
        });
    });
  });
};
exports.UserGuardified = function () {
  describe('UserGuardified', function () {
    describe('create Role-User relation ', function () {
      it('single : should assign role', function (done) {
        this.guard._sequelize.models.User.findByPk(1).then(function (user) {
          user.assignRole('admin').then((user) => {
            user.getRoles().then((roles) => {
              expect(roles.length).to.equal(1);
              done();
            });
          });
        });
      });

      it('multiple : should assign without duplicate', function (done) {
        this.guard._sequelize.models.User.findByPk(1)
          .then(function (user) {
            user
              .assignRoles(['admin', 'superadmin', 'moderator'])
              .then((result) => {
                expect(result.length).to.equal(2);

                user.getRoles().then((roles) => {
                  expect(roles.length).to.equal(3);
                  done();
                });
              });
          })
          .catch((err) => {
            console.log(err);
            assert(!err);
            done();
          });
      });
    });

    describe('Remove Role-User relation ', function () {
      it('single : should remove role', function (done) {
        this.guard._sequelize.models.User.findByPk(1).then(function (user) {
          user.rmAssignedRoles('admin').then((result) => {
            expect(result).to.equal(1);

            user.getRoles().then((roles) => {
              expect(roles.length).to.equal(2);
              done();
            });
          });
        });
      });

      it('multiple : should remove roles', function (done) {
        this.guard._sequelize.models.User.findByPk(1).then(function (user) {
          user
            .rmAssignedRoles(['superadmin', 'moderator', 'toddle'])
            .then((result) => {
              expect(result).to.equal(2);
              user.getRoles().then((roles) => {
                expect(roles.length).to.equal(0);
                done();
              });
            });
        });
      });
    });
  });
};

exports.MakeControl = function () {
  describe('MakeControl', function () {
    it('add admin role to control', function () {
      let res = this.guard.init().allow('admin');

      expect(res._roles).to.include('admin');
    });

    it('should not accept anything other than string for role', function () {
      let res = this.guard.init().allow('admin').allow(3);

      expect(res._roles).to.include('admin');
    });
    // it('add multiple admin role to control', function(){
    //     let res = this.guard.init().allow(['admin','moderator']);
    //     expect(res._roles.length).to.equal(2);
    // });

    it('add view action to control', function () {
      let res = this.guard.init().to('view');
      expect(res._actions).to.include('view');
    });

    it('add blog resource to control', function () {
      let res = this.guard.init().on('blog');
      expect(res._resources).to.include('blog');
    });
    it('should reset control sets', function () {
      let res = this.guard.init();
      expect(res._roles.length).to.equal(0);
      expect(res._actions.length).to.equal(0);
      expect(res._resources.length).to.equal(0);
    });

    it('commit basic control', async function () {
      return this.guard
        .init()
        .allow('admin')
        .to(['view', 'edit'])
        .on('blog')
        .commit()
        .then((data) => {
          expect(data.permissions.length).to.equal(1);
          expect(data.role.name).to.equal('admin');
        })
        .catch((e) => {
          assert(!e);
        });
    });

    it('commit basic control 2', async function () {
      return this.guard
        .init()
        .allow('superadmin')
        .to(['*'])
        .on('*')
        .commit()
        .then((data) => {
          expect(data.permissions.length).to.equal(1);
          expect(data.role.name).to.equal('superadmin');
        })
        .catch((e) => {
          assert(!e);
        });
    });
    it('commit basic control 3', async function () {
      return this.guard
        .init()
        .allow('admin')
        .to(['*'])
        .on(['blog', 'post', 'image'])
        .commit()
        .then((data) => {
          expect(data.permissions.length).to.equal(4);
          expect(data.role.name).to.equal('admin');
        })
        .catch((e) => {
          assert(!e);
        });
    });
    it('commit control 4', async function () {
      return this.guard
        .init()
        .on(['blog', 'post', 'image', 'notice'])
        .allow('moderator')
        .to(['view', 'edit', 'update'])
        .commit()
        .then((data) => {
          expect(data.permissions.length).to.equal(4);
          expect(data.role.name).to.equal('moderator');
        })
        .catch((e) => {
          assert(!e);
        });
    });

    it('should commit control, SequelizeGuard allow api, return permissions and roles', function () {
      return this.guard
        .allow('user', ['view'], ['blog', 'post', 'notice'])
        .then((data) => {
          expect(data.permissions.length).to.equal(3);
          expect(data.role.name).to.equal('user');
        });
    });
    it('should commit control, SequelizeGuard allow api, return permissions and roles ; checking new role', function () {
      return this.guard.allow('user8', ['view'], ['gallery']).then((data) => {
        expect(data.permissions.length).to.equal(1);
        expect(data.role.name).to.equal('user8');
      });
    });
  });
};

exports.GuardSetup = function () {
  describe('GuardSetup', function () {
    it('it should assign role to user', async function () {
      let guard = this.guard;
      return this.guard._sequelize.models.User.findByPk(1)
        .then(function (user) {
          return guard.assignRole(user, 'superadmin').then((user) => {
            return user.getRoles();
          });
        })
        .then((roles) => {
          expect(roles.length).to.equal(1);
        })
        .catch((err) => {
          console.log('exports.GuardSetup -> err', err);
        });
    });

    it('it should assign roles to user', async function () {
      let guard = this.guard;
      return this.guard._sequelize.models.User.findByPk(2)
        .then(function (user) {
          return guard.assignRoles(user, ['superadmin', 'admin', 'user']);
        })
        .then((roles) => {
          expect(roles.length).to.equal(3);
        });
    });

    it('it should assign role to user 2', async function () {
      let guard = this.guard;
      return this.guard._sequelize.models.User.findByPk(3)
        .then(function (user) {
          return guard.assignRole(user, 'analyst').then((user) => {
            return user.getRoles();
          });
        })
        .then((roles) => {
          expect(roles.length).to.equal(1);
        })
        .then(() => {
          return this.guard._sequelize.models.User.findByPk(4)
            .then(function (user) {
              return guard.assignRole(user, 'user').then((user) => {
                return user.getRoles();
              });
            })
            .then((roles) => {
              expect(roles.length).to.equal(1);
            });
        });
    });
    it('it should remove assigned roles from user', async function () {
      let guard = this.guard;
      return this.guard._sequelize.models.User.findByPk(2)
        .then(function (user) {
          return guard.rmAssignedRoles(user, ['superadmin']).then((res) => {
            expect(res).to.equal(1);
            return user.getRoles();
          });
        })
        .then((roles) => {
          expect(roles.length).to.equal(2);
        });
    });
  });
};

exports.GuardAuthorize = function () {
  describe('GuardAuthorize', function () {
    describe('roles', function () {
      it('should return all roles of a user, 1 role for user_id 1', function () {
        return this.guard
          .models()
          .GuardUser.findByPk(1)
          .then(async (user) => {
            let roles = await user.roles();
            expect(roles.length).to.equal(1);
          });
      });

      it('should return all roles of a user, 2 roles for user_id 2', function () {
        return this.guard
          .models()
          .GuardUser.findByPk(2)
          .then(async (user) => {
            let roles = await user.roles();
            expect(roles.length).to.equal(2);
          });
      });

      it('should return true if user has given roles, true for user_id 1, superadmin', function () {
        return this.guard
          .models()
          .GuardUser.findByPk(1)
          .then(async (user) => {
            let a = await user.isAnyOf(['superadmin', 'admin']);
            assert(a);
          });
      });

      it('should return true if user has any of given roles, true for user_id 2, [ user & admin ]', function () {
        return this.guard
          .models()
          .GuardUser.findByPk(2)
          .then(async (user) => {
            let a = await user.isAnyOf(['user', 'admin']);
            assert(a);
          });
      });
      it('should return true if user has all given roles, true for user_id 2, [ user & admin ]', function () {
        return this.guard
          .models()
          .GuardUser.findByPk(2)
          .then(async (user) => {
            let a = await user.isAllOf(['user', 'admin']);
            assert(a);
          });
      });

      it('should return false if user do not have all given roles, false for user_id 1, [ superadmin ]', function () {
        return this.guard
          .models()
          .GuardUser.findByPk(1)
          .then(async (user) => {
            let a = await user.isAllOf(['admin', 'superadmin']);
            assert(!a);
          });
      });

      it('should return false if user do not have all given roles, true for user_id 2, [ user & admin ]', function () {
        return this.guard
          .models()
          .GuardUser.findByPk(2)
          .then(async (user) => {
            let a = await user.isAllOf(['user', 'admin', 'superadmin']);
            assert(!a);
          });
      });
      it('should return true if user has given role, true for user_id 2, [ user & admin ], checking isA', function () {
        return this.guard
          .models()
          .GuardUser.findByPk(2)
          .then(async (user) => {
            let a = await user.isA('user');
            assert(a);
          });
      });

      it('should return true if user has given role, true for user_id 2, [ user & admin ], checking isAn', function () {
        return this.guard
          .models()
          .GuardUser.findByPk(2)
          .then(async (user) => {
            let a = await user.isAn('admin');
            assert(a);
          });
      });
      it('should return false if user do not have given role, true for user_id 2, [ user & admin ]', function () {
        return this.guard
          .models()
          .GuardUser.findByPk(2)
          .then(async (user) => {
            let a = await user.isA('superadmin');
            assert(!a);
          });
      });
    });

    describe('all permissions', function () {
      it('should allow superadmin to *', function () {
        return this.guard
          .models()
          .GuardUser.findByPk(1)
          .then(async (user) => {
            let a = await user.can('*');
            assert(a);
          });
      });
      it('should not allow admin to *', function () {
        return this.guard
          .models()
          .GuardUser.findByPk(2)
          .then(async (user) => {
            let a = await user.can('*');
            assert(!a);
          });
      });

      it('it should not allow user to edit blog', function () {
        return this.guard
          .models()
          .GuardUser.findByPk(4)
          .then(async (user) => {
            let a = await user.can('edit blog');
            assert(!a);
          });
      });

      it('it should not allow user to edit blog, check with cant', function () {
        return this.guard
          .models()
          .GuardUser.findByPk(4)
          .then(async (user) => {
            let a = await user.cant('edit blog');
            assert(a);
          });
      });
    });

    describe('permissions', () => {
      it('it should allow user to view blog', function () {
        return this.guard._sequelize.models.User.findByPk(4).then(
          async (user) => {
            let a = await user.can('view blog');
            assert(a);
          }
        );
      });
      it('it should allow admin to * blog', function () {
        return this.guard._sequelize.models.User.findByPk(2).then(
          async function (user) {
            let a = await user.can('* blog');
            assert(a);
          }
        );
      });
      it('it should allow analyst to view *', function () {
        return this.guard._sequelize.models.User.findByPk(3).then(
          async function (user) {
            let a = await user.can('view *');
            assert(a);
          }
        );
      });

      it('it should allow user to edit blog', function () {
        return this.guard._sequelize.models.User.findByPk(4).then(
          async function (user) {
            let a = await user.can('edit blog');
            assert(!a);
          }
        );
      });
      it('it should setup cache', function () {
        return this.guard.getCache().then((cache) => {
          // console.log('test setup cache', cache);
        });
      });
    });
  });
};

exports.Events = function () {
  describe('Events', function () {
    it('should register, listen on onRolesCreated event, remove with returned fn', function () {
      const rmCb = this.guard.onRolesCreated(
        function (data) {
          expect(data.length).to.equal(1);
          rmCb();
          expect(this.guard._ee.listenerCount('onRolesCreated')).to.equal(1);
        }.bind(this)
      );

      expect(this.guard._ee.listenerCount('onRolesCreated')).to.equal(2);
      this.guard.makeRole('EventOnRolesCreatedRole');
    });
    it('should register, listen on someEvent event, removed "AFTER" one call', function () {
      this.guard.once(
        'someEvent',
        function (data) {
          expect(data.length).to.equal(1);
          expect(this.guard._ee.listenerCount('someEvent')).to.equal(0);
        }.bind(this)
      );

      expect(this.guard._ee.listenerCount('someEvent')).to.equal(1);
      this.guard._ee.emit('someEvent', ['a']);
    });
    it('should register, listen on someEvent event, removed "BEFORE" one call', function () {
      const cb = this.guard.once(
        'someEvent',
        function (data) {
          assert(!data);
        }.bind(this)
      );

      expect(this.guard._ee.listenerCount('someEvent')).to.equal(1);
      cb();
      expect(this.guard._ee.listenerCount('someEvent')).to.equal(0);
      this.guard._ee.emit('someEvent', ['a']);
    });
  });
};

exports.Miscellaneous = function () {
  describe('Miscellaneous', function () {
    it('should reset cache', function () {
      let cache = this.guard.resetCache();
      expect(cache.stats.keys).to.equal(0);
    });
    it('should reset user cache', function () {
      let cache = this.guard.resetUserCache();
      expect(cache.stats.keys).to.equal(0);
    });
    // it('it should setup cache', function () {

    // });
  });
};

exports.customConfig = function () {
  describe('SequelizeGuard init custom config', function () {
    before(function (done) {
      let seqGuard2 = new SequelizeGuard(this.seqMem3, {
        sync: true,
        debug: false,
        timestamps: true,
        paranoid: false,
        userCache: false,
      });

      this.guard2 = seqGuard2;
      done();
    });

    it('should work without user cache', function (done) {
      let self = this;
      self.guard2
        .makeUser({ name: 'SuperAdmin', email: 'superadmin@test.com' })
        .then(function (user) {
          self.guard2.getUserRoles(user).then((roles) => {
            // roles
            expect(roles).to.be.an('array');
            done();
          });
        });
    });
  });
};
