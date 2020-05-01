// Importing mocha and chai
const mocha = require('mocha');
const chai = require('chai');
var expect = chai.expect;
var assert = chai.assert;

var schemas = require('../lib/migrations/acl-schema').schemas;

var SequelizeAcl = require('../lib/index');

exports.init = function () {
  describe('SequelizeACL init custom config', function () {
    it('should be initialized when user passed', function (done) {
      let AclUser = this.seqMem1.define('User', schemas['users'], {
        tableName: `acl_users`,
      });
      let seqAcl = new SequelizeAcl(this.seqMem1, {
        sync: false,
        debug: false,
        timestamps: true,
        paranoid: true,
        UserModel: AclUser,
      });

      if (seqAcl) {
        this.__proto__.seqMem1 = null;
        done();
      }
    });

    it('should be initialized with options 2', function (done) {
      let seqAcl = new SequelizeAcl(this.seqMem2, {
        sync: true,
        debug: true,
        timestamps: true,
        paranoid: false,
      });

      if (seqAcl) {
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
      bulkInsert: function (tableName, data) {
        seeds.push(tableName);
      },
      bulkDelete: function (tableName, data) {
        seeds.push(tableName);
      },
    };

    it('properly runs up migration', function () {
      migration = [];
      // ['acl_actions', 'acl_resources', 'acl_permissions', 'acl_roles', 'acl_role_user', 'acl_role_permission'  ];
      let expected = SequelizeAcl.migration.tables.map((t) => 'acl_' + t);

      SequelizeAcl.migration.up(queryInterfaceStub, this.acl.sequelize);

      assert.deepEqual(migration, expected);
    });

    it('properly runs up migration with options', function () {
      migration = [];
      // ['acl_actions', 'acl_resources', 'acl_permissions', 'acl_roles', 'acl_role_user', 'acl_role_permission'  ];
      let expected = SequelizeAcl.migration.tables.map((t) => 'acl_' + t);

      SequelizeAcl.migration.up(queryInterfaceStub, this.acl.sequelize, {
        prefix: 'acl_',
        timestamps: true,
        paranoid: true,
      });

      assert.deepEqual(migration, expected);
    });

    it('properly runs down migrations', function () {
      migration = [];
      // ['acl_actions', 'acl_resources', 'acl_permissions', 'acl_roles', 'acl_role_user', 'acl_role_permission'  ];
      let expected = SequelizeAcl.migration.tables.map((t) => 'acl_' + t);

      SequelizeAcl.migration.down(queryInterfaceStub, this.acl.sequelize);
      assert.deepEqual(migration, expected);
    });
    it('properly runs down migrations with options', function () {
      migration = [];
      // ['acl_actions', 'acl_resources', 'acl_permissions', 'acl_roles', 'acl_role_user', 'acl_role_permission'  ];
      let expected = SequelizeAcl.migration.tables.map((t) => 'acl_' + t);

      SequelizeAcl.migration.down(queryInterfaceStub, this.acl.sequelize, {
        prefix: 'acl_',
      });
      assert.deepEqual(migration, expected);
    });

    it('properly runs up seeder', function () {
      seeds = [];
      let expected = ['acl_roles'];

      SequelizeAcl.seeder.up(queryInterfaceStub, this.acl.sequelize);
      assert.deepEqual(seeds, expected);
    });

    it('properly runs down seeder', function () {
      seeds = [];
      let expected = ['acl_roles'];

      SequelizeAcl.seeder.down(queryInterfaceStub, this.acl.sequelize);
      assert.deepEqual(seeds, expected);
    });

    it('should return all acl models, i.e. 6 models', function () {
      expect(Object.keys(this.acl.models()).length).to.equal(6);
    });
  });
};

exports.Permissions = function () {
  describe('Permissions', function () {
    it('should create permission single action', function (done) {
      this.acl
        .createPermissions('blog', 'view')
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
      this.acl
        .createPermissions('blog', ['view', 'edit'])
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
      this.acl
        .createPermissions('blog', ['view', 'edit'])
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
      this.acl
        .createPermissions(['blog', 'users'], ['view', 'edit'], {
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
      this.acl
        .createPermissions(['blog', 'users', 'admin'], ['view', 'edit'], {
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
      return this.acl
        .createPermissionsBulk(
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
      return this.acl
        .createPermissionsBulk([
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
        return this.acl
          .findPermissions({ resource: 'blog', action: 'view', search: true })
          .then((perms) => {
            expect(perms).to.be.an('array');
          });
      });
      it('should find perms by name in search mode', async function () {
        return this.acl
          .findPermissions({ name: 'blog', search: true })
          .then((perms) => {
            expect(perms).to.be.an('array');
          });
      });
      it('should find perms by resource action by exact match', async function () {
        return this.acl
          .findPermissions({ resource: 'blog', action: 'view' })
          .then((perms) => {
            expect(perms).to.be.an('array');
          });
      });
      it('should find perms by name by exact match', async function () {
        return this.acl
          .findPermissions({ name: 'blog:[view]' })
          .then((perms) => {
            expect(perms).to.be.an('array');
          });
      });
      it('should return all permissions when no args ', async function () {
        return this.acl.findPermissions().then((perms) => {
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
      this.acl
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
      this.acl
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
      this.acl
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
      return this.acl
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
      return this.acl
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
      this.acl.allRoles().then((roles) => {
        expect(roles.length).to.equal(5);
      });
    });
    it('should return find roles by name ', function () {
      this.acl.findRoles({ name: 'admin' }).then((roles) => {
        expect(roles[0].name).to.equal('admin');
      });
    });
    it('should return find roles by names, exact match', function () {
      this.acl
        .findRoles({ names: ['admin', 'analyst', 'admin5'] })
        .then((roles) => {
          expect(roles.length).to.equal(2);
        });
    });
    it('should return find roles by names, search mode', function () {
      this.acl
        .findRoles({ names: ['admin', 'mod'], search: true })
        .then((roles) => {
          expect(roles.length).to.equal(3);
        });
    });

    it('should return find roles by names with parents', function () {
      this.acl
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
      this.acl.findRoles().then((roles) => {
        expect(roles.length).to.equal(5);
      });
    });
    it('should return all roles by default when names array size is 0 ', function () {
      this.acl.findRoles({ names: [] }).then((roles) => {
        expect(roles.length).to.equal(5);
      });
    });
    // });

    // describe('Delete Role(s)', function () {
    it('single: should delete role', function (done) {
      this.acl
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
      this.acl
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
      this.acl.deleteRoles('admin3').then(function (data) {
        expect(data).to.equal(0);
        done();
      });
    });
    // });

    it('should throw error for array as argument for role', function (done) {
      this.acl
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
  });
};

exports.Users = function () {
  describe('Users', function () {
    it('should create user', function (done) {
      this.acl
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
      this.acl._models.AclUser.bulkCreate(users)
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
exports.UserAclified = function () {
  describe('UserAclified', function () {
    describe('create Role-User relation ', function () {
      it('single : should assign role', function (done) {
        this.acl._sequelize.models.User.findByPk(1).then(function (user) {
          user.assignRole('admin').then((user) => {
            user.getRoles().then((roles) => {
              expect(roles.length).to.equal(1);
              done();
            });
          });
        });
      });

      it('multiple : should assign without duplicate', function (done) {
        this.acl._sequelize.models.User.findByPk(1)
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
        this.acl._sequelize.models.User.findByPk(1).then(function (user) {
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
        this.acl._sequelize.models.User.findByPk(1).then(function (user) {
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
      let res = this.acl.init().allow('admin');

      expect(res._roles).to.include('admin');
    });

    it('should not accept anything other than string for role', function () {
      let res = this.acl.init().allow('admin').allow(3);

      expect(res._roles).to.include('admin');
    });
    // it('add multiple admin role to control', function(){
    //     let res = this.acl.init().allow(['admin','moderator']);
    //     expect(res._roles.length).to.equal(2);
    // });

    it('add view action to control', function () {
      let res = this.acl.init().to('view');
      expect(res._actions).to.include('view');
    });

    it('add blog resource to control', function () {
      let res = this.acl.init().on('blog');
      expect(res._resources).to.include('blog');
    });
    it('should reset control sets', function () {
      let res = this.acl.init();
      expect(res._roles.length).to.equal(0);
      expect(res._actions.length).to.equal(0);
      expect(res._resources.length).to.equal(0);
    });

    it('commit basic control', async function () {
      return this.acl
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
      return this.acl
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
      return this.acl
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
      return this.acl
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
    it('commit control 5', function () {
      return this.acl
        .init()
        .on(['*'])
        .allow('analyst')
        .to(['view'])
        .commit()
        .then((data) => {
          expect(data.permissions.length).to.equal(1);
          expect(data.role.name).to.equal('analyst');
        });
    });

    it('should commit control, SequelizeAcl allow api, return permissions and roles', function () {
      return this.acl
        .allow('user', ['view'], ['blog', 'post', 'notice'])
        .then((data) => {
          expect(data.permissions.length).to.equal(3);
          expect(data.role.name).to.equal('user');
        });
    });
    it('should commit control, SequelizeAcl allow api, return permissions and roles ; checking new role', function () {
      return this.acl.allow('user8', ['view'], ['gallery']).then((data) => {
        expect(data.permissions.length).to.equal(1);
        expect(data.role.name).to.equal('user8');
      });
    });
  });
};

exports.AclSetup = function () {
  describe('AclSetup', function () {
    it('it should assign role to user', async function () {
      let acl = this.acl;
      return this.acl._sequelize.models.User.findByPk(1)
        .then(function (user) {
          return acl.assignRole(user, 'superadmin').then((user) => {
            return user.getRoles();
          });
        })
        .then((roles) => {
          expect(roles.length).to.equal(1);
        })
        .catch((err) => {
          console.log('exports.AclSetup -> err', err);
        });
    });

    it('it should assign roles to user', async function () {
      let acl = this.acl;
      return this.acl._sequelize.models.User.findByPk(2)
        .then(function (user) {
          return acl.assignRoles(user, ['superadmin', 'admin', 'user']);
        })
        .then((roles) => {
          expect(roles.length).to.equal(3);
        });
    });

    it('it should assign role to user 2', async function () {
      let acl = this.acl;
      return this.acl._sequelize.models.User.findByPk(3)
        .then(function (user) {
          return acl.assignRole(user, 'analyst').then((user) => {
            return user.getRoles();
          });
        })
        .then((roles) => {
          expect(roles.length).to.equal(1);
        })
        .then(() => {
          return this.acl._sequelize.models.User.findByPk(4)
            .then(function (user) {
              return acl.assignRole(user, 'user').then((user) => {
                return user.getRoles();
              });
            })
            .then((roles) => {
              expect(roles.length).to.equal(1);
            });
        });
    });
    it('it should remove assigned roles from user', async function () {
      let acl = this.acl;
      return this.acl._sequelize.models.User.findByPk(2)
        .then(function (user) {
          return acl.rmAssignedRoles(user, ['superadmin']).then((res) => {
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

exports.AclAuthorize = function () {
  describe('AclAuthorize', function () {
    describe('roles', function () {
      it('should return all roles of a user, 1 role for user_id 1', function () {
        return this.acl
          .models()
          .AclUser.findByPk(1)
          .then(async (user) => {
            let roles = await user.roles();
            expect(roles.length).to.equal(1);
          });
      });

      it('should return all roles of a user, 2 roles for user_id 2', function () {
        return this.acl
          .models()
          .AclUser.findByPk(2)
          .then(async (user) => {
            let roles = await user.roles();
            expect(roles.length).to.equal(2);
          });
      });
    });
    describe('all permissions', function () {
      it('should allow superadmin to *', function () {
        return this.acl
          .models()
          .AclUser.findByPk(1)
          .then(async (user) => {
            let a = await user.can('*');
            assert(a);
          });
      });
      it('should not allow admin to *', function () {
        return this.acl
          .models()
          .AclUser.findByPk(2)
          .then(async (user) => {
            let a = await user.can('*');
            assert(!a);
          });
      });

      it('it should not allow user to *', function () {
        return this.acl
          .models()
          .AclUser.findByPk(4)
          .then(async (user) => {
            let a = await user.can('edit blog');
            assert(!a);
          });
      });
    });
    it('it should allow user to view blog', function () {
      return this.acl._sequelize.models.User.findByPk(4).then(async (user) => {
        let a = await user.can('view blog');
        assert(a);
      });
    });
    it('it should allow admin to * blog', function () {
      return this.acl._sequelize.models.User.findByPk(2).then(async function (
        user
      ) {
        let a = await user.can('* blog');
        assert(a);
      });
    });
    it('it should allow analyst to view *', function () {
      return this.acl._sequelize.models.User.findByPk(3).then(async function (
        user
      ) {
        let a = await user.can('view *');
        assert(a);
      });
    });

    it('it should allow user to edit blog', function () {
      return this.acl._sequelize.models.User.findByPk(4).then(async function (
        user
      ) {
        let a = await user.can('edit blog');
        assert(!a);
      });
    });
    it('it should setup cache', function () {
      return this.acl.getCache().then((cache) => {
        // console.log('test setup cache', cache);
      });
    });
  });
};

exports.Events = function () {
  describe('Events', function () {
    it('should register, listen on onRolesCreated event, remove with returned fn', function () {
      const rmCb = this.acl.onRolesCreated(
        function (data) {
          expect(data.length).to.equal(1);
          rmCb();
          expect(this.acl._ee.listenerCount('onRolesCreated')).to.equal(1);
        }.bind(this)
      );

      expect(this.acl._ee.listenerCount('onRolesCreated')).to.equal(2);
      this.acl.makeRole('EventOnRolesCreatedRole');
    });
    it('should register, listen on someEvent event, removed "AFTER" one call', function () {
      this.acl.once(
        'someEvent',
        function (data) {
          expect(data.length).to.equal(1);
          expect(this.acl._ee.listenerCount('someEvent')).to.equal(0);
        }.bind(this)
      );

      expect(this.acl._ee.listenerCount('someEvent')).to.equal(1);
      this.acl._ee.emit('someEvent', ['a']);
    });
    it('should register, listen on someEvent event, removed "BEFORE" one call', function () {
      const cb = this.acl.once(
        'someEvent',
        function (data) {
          assert(!data);
        }.bind(this)
      );

      expect(this.acl._ee.listenerCount('someEvent')).to.equal(1);
      cb();
      expect(this.acl._ee.listenerCount('someEvent')).to.equal(0);
      this.acl._ee.emit('someEvent', ['a']);
    });
  });
};

exports.Miscellaneous = function () {
  describe('Miscellaneous', function () {
    it('should reset cache', function () {
      let cache = this.acl.resetCache();
      expect(cache.stats.keys).to.equal(0);
    });
    it('should reset user cache', function () {
      let cache = this.acl.resetUserCache();
      expect(cache.stats.keys).to.equal(0);
    });
    // it('it should setup cache', function () {

    // });
  });
};

exports.customConfig = function () {
  describe('SequelizeACL init custom config', function () {
    before(function (done) {
      let seqAcl2 = new SequelizeAcl(this.seqMem3, {
        sync: true,
        debug: false,
        timestamps: true,
        paranoid: false,
        userCache: false,
      });

      this.acl2 = seqAcl2;
      done();
    });

    it('should work without user cache', function () {
      let self = this;
      self.acl2
        .makeUser({ name: 'SuperAdmin', email: 'superadmin@test.com' })
        .then(function (user) {
          self.acl2.getUserRoles(user).then((roles) => {
            // roles
            expect(data.dataValues.name).to.equal('SuperAdmin');
            done();
          });
        });
    });
  });
};
