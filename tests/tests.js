// Importing mocha and chai
const mocha = require('mocha')
const chai = require('chai')
var expect = chai.expect;
var assert = chai.assert;

var schemas = require('../lib/migrations/acl-schema').schemas;

var SequelizeAcl = require('../lib/index');


exports.init = function () {
    describe('SequelizeACL init ', function(){

        it('should be initialized when user passed', function(done){
            let AclUser = this.seqMem1.define("User", schemas['users'], {tableName : `acl_users`});
            let seqAcl =  new SequelizeAcl(this.seqMem1, {sync : false, debug: false, timestamps : true, paranoid : true, UserModel: AclUser});

            if(seqAcl){
                this.__proto__.seqMem1 = null;
                done()
            }
        });

        it('should be initialized with options 2', function(done){
            let seqAcl =  new SequelizeAcl(this.seqMem2, {sync : true, debug: true, timestamps : true, paranoid : false});
            let seqAcl2 =  new SequelizeAcl(this.seqMem3, {sync : true, debug: false, timestamps : true, paranoid : false});
            
            if(seqAcl && seqAcl2){
                this.__proto__.seqMem2 = null;
                this.__proto__.seqMem3 = null;
                done()
            }
        });

    })
};

exports.Constructor = function () {

    // Group of tests using describe
    describe('setup', function () {

        let migration = [], seeds = [];
        let queryInterfaceStub = {
            createTable: function(tableName, schema) {
                migration.push(tableName);
            },
            dropTable: function(tableName, schema) {
                migration.push(tableName);
            },
            bulkInsert : function(tableName, data) {
                seeds.push(tableName);
            }, 
            bulkDelete : function(tableName, data) {
                seeds.push(tableName);
            },
        };

        it('properly runs up migration', function() {

            migration = [];
            // ['acl_actions', 'acl_resources', 'acl_permissions', 'acl_roles', 'acl_role_user', 'acl_role_permission'  ];
            let expected = SequelizeAcl.migration.tables.map(t => 'acl_'+t);

            SequelizeAcl.migration.up(queryInterfaceStub, this.acl.sequelize);

            assert.deepEqual(migration, expected);
        });

        it('properly runs up migration with options', function() {
            migration = [];
            // ['acl_actions', 'acl_resources', 'acl_permissions', 'acl_roles', 'acl_role_user', 'acl_role_permission'  ];
            let expected = SequelizeAcl.migration.tables.map(t => 'acl_'+t);

            SequelizeAcl.migration.up(queryInterfaceStub, this.acl.sequelize, { prefix: 'acl_', timestamps: true , paranoid : true});

            assert.deepEqual(migration, expected);
        });
        
        it('properly runs down migrations', function() {
            migration = [];            
            // ['acl_actions', 'acl_resources', 'acl_permissions', 'acl_roles', 'acl_role_user', 'acl_role_permission'  ];
            let expected = SequelizeAcl.migration.tables.map(t => 'acl_'+t);

            SequelizeAcl.migration.down(queryInterfaceStub, this.acl.sequelize);
            assert.deepEqual(migration, expected);
        });
        it('properly runs down migrations with options', function() {
            migration = [];            
            // ['acl_actions', 'acl_resources', 'acl_permissions', 'acl_roles', 'acl_role_user', 'acl_role_permission'  ];
            let expected = SequelizeAcl.migration.tables.map(t => 'acl_'+t);

            SequelizeAcl.migration.down(queryInterfaceStub, this.acl.sequelize, { prefix: 'acl_' });
            assert.deepEqual(migration, expected);
        });

        it('properly runs up seeder', function() {
            seeds = [];
            let expected = ['acl_roles'];

            SequelizeAcl.seeder.up(queryInterfaceStub, this.acl.sequelize);
            assert.deepEqual(seeds, expected);
        });
        
        it('properly runs down seeder', function() {
            seeds = [];
            let expected = ['acl_roles'];

            SequelizeAcl.seeder.down(queryInterfaceStub, this.acl.sequelize);
            assert.deepEqual(seeds, expected);
        });
        
    });
}


exports.Permissions = function(){
    describe('Permissions', function(){
        it('should create permission single action', function(done){

            this.acl.createPermissions('blog','view')
                .then(function(perms){
                    expect(perms[0].name).to.equal('blog:[view]');
                    done();
                }).catch((err)=>{
                    assert(!err);
                    done();
                })
        })
        it('should create permission multiple actions', function(done){
            this.acl.createPermissions('blog',['view','edit'])
                .then(function(perms){
                    expect(perms[0].name).to.equal('blog:[view,edit]');
                    done();
                }).catch((err)=>{
                    assert(!err);
                    done();
                })
        })
        it('should not create duplicate permission', function(done){
            this.acl.createPermissions('blog',['view','edit'])
                .then(function(perms){
                    expect(perms.length).to.equal(0);
                    done();
                }).catch((err)=>{
                    assert(!err);
                    done();
                })
        });

        it('should create permission with "multiple resources" return created', function(done){
            this.acl.createPermissions(['blog','users'],['view','edit'], { 
                    names:['','blog_main'],
                    json :true
                }).then(function(perms){
                    expect(perms.length).to.equal(1);
                    done();
                }).catch((err)=>{
                    assert(!err);
                    done();
                })
        });

        it('should create permission with "multiple resources" return all', function(done){
            this.acl.createPermissions(['blog','users','admin'],['view','edit'], { 
                    names:['','blog_main'],
                    all: true
                }).then(function(perms){
                    expect(perms.length).to.equal(3);
                    done();
                }).catch((err)=>{
                    assert(!err);
                    done();
                })
        })

    });
}

exports.Roles = function(){
    describe('Roles', function(){

        describe('Create Role(s)', function(){
            it('single: should create role by string', function(done){
                this.acl.makeRole('admin').then(function(data){
                    expect(data.role.dataValues.name).to.equal('admin');
                    done();
                }).catch((err)=>{
                    assert(!err);
                    done();
                })
            });
            it('single: should create role by object', function(done){
                this.acl.makeRole({name : 'someadmin'}).then(function(data){
                    expect(data.role.dataValues.name).to.equal('someadmin');
                    done();
                }).catch((err)=>{
                    assert(!err);
                    done();
                })
            });

            it('single: should not create for empty string', function(done){
                this.acl.makeRole('').then(function(data){
                    expect(!data);
                    done();
                }).catch((err)=>{
                    assert(err);
                    done();
                })
            });

            it('multiple: should not create duplicate, return created roles', function(done){
                this.acl.makeRoles(['admin','moderator',{ name:'user', description:"A basic user"}]).then(function(data){
                    expect(data.length).to.equal(2);
                    done();
                }).catch((err)=>{
                    assert(!err);
                    done();
                })
            })

            it('multiple: should not create duplicate, return all roles', function(done){
                this.acl.makeRoles(['admin','analyst',{ name:'user', description:"A basic user"}], {all : true, json:true}).then(function(data){
                    expect(data.length).to.equal(3);
                    done();
                }).catch((err)=>{
                    assert(!err);
                    done();
                })
            })
        })

        describe('Delete Role(s)', function(){
            it('single: should delete role', function(done){
                this.acl.deleteRoles('admin').then(function(data){
                    expect(data).to.equal(1);
                    done();
                }).catch((err)=> {
                    assert(!err);
                    done();
                })
            });

            it('multiple: should delete roles', function(done){
                this.acl.deleteRoles(['admin', {name :'moderator'}]).then(function(data){
                    expect(data).to.equal(1);
                    done();
                }).catch((err)=>{
                    assert(!err);
                    done();
                })
            });
        })

        it('should throw error for array as argument for role', function(done){
            this.acl.deleteRoles([3,'analyst', {name :'moderator'}]).then(function(data){
                assert(!data);
                done();
            }).catch((err)=>{
                assert(err);
                done();
            })
        });

    });
}

exports.Users = function(){
    describe('Users', function(){
        it('should create user', function(done){
            this.acl.makeUser({name: "SuperAdmin", email: "superadmin@test.com" }).then(function(data){
                expect(data.dataValues.name).to.equal('SuperAdmin');
                done();
            }).catch((err)=>{
                assert(!err);
                done();
            })
        })

        it('should create user 2', function(done){
            let users = [
                {name: "SomeAdmin", email: "someAdmin@test.com" },
                {name: "fleur editor", email: "editor@test.com" },
                {name: "User 1", email: "myuser@test.com" },
            ];
            this.acl._models.AclUser.bulkCreate(users).then(function(data){
                expect(data.length).to.equal(3);
                done();
            }).catch((err)=>{
                assert(!err);
                done();
            })
        })


    });
}
exports.UserAclified = function(){
    describe('UserAcliefied', function(){

        describe('create Role-User relation ', function(){
            it('single : should assign role', function(done){
                this.acl._sequelize.models.User.findByPk(1).then(function(user){
                    user.assignRole('admin').then(user=>{
                        user.getRoles().then(roles => {
                            expect(roles.length).to.equal(1);
                            done();
                        })
                    })
                });
            })

            it('multiple : should assign without duplicate', function(done){
                this.acl._sequelize.models.User.findByPk(1).then(function(user){
                    user.assignRoles(['admin', 'superadmin', 'moderator']).then(result=>{
                        expect(result.length).to.equal(2);

                        user.getRoles().then(roles => {
                            expect(roles.length).to.equal(3);
                            done();
                        })
                    })
                }).catch((err)=>{
                    console.log(err);
                    assert(!err);
                    done();
                })
            });

        });

        describe('Remove Role-User relation ', function(){
            it('single : should remove role', function(done){
                this.acl._sequelize.models.User.findByPk(1).then(function(user){
                    user.rmAssignedRoles('admin').then(result => {
                        expect(result).to.equal(1);

                        user.getRoles().then(roles => {
                            expect(roles.length).to.equal(2);
                            done();
                        })
                    })  
                });
            })

            it('multiple : should remove roles', function(done){
                this.acl._sequelize.models.User.findByPk(1).then(function(user){
                    user.rmAssignedRoles(['superadmin','moderator','toddle']).then(result => {
                        expect(result).to.equal(2);
                        user.getRoles().then(roles => {
                            expect(roles.length).to.equal(0);
                            done();
                        })
                    })
                });
            });

        });
    });
}

exports.MakeControl = function(){
    describe('MakeControl', function(){
        it('add admin role to control', function(){
            let res = this.acl.init().allow('admin');

            expect(res._control._roles).to.include('admin');
        });
        
        it('should not accept anything other than string for role', function(){
            let res = this.acl.init().allow('admin').allow(3);

            expect(res._control._roles).to.include('admin');
        });
        // it('add multiple admin role to control', function(){
        //     let res = this.acl.init().allow(['admin','moderator']);
        //     expect(res._control._roles.length).to.equal(2);
        // });

        it('add view action to control', function(){
            let res = this.acl.to('view');
            expect(res._control._actions).to.include('view');
        });

        it('add blog resource to control', function(){
            let res = this.acl.on('blog');
            expect(res._control._resources).to.include('blog');
        });
        it('should reset control sets', function(){
            let res = this.acl.init();
            expect(res._control._roles.length).to.equal(0);
            expect(res._control._actions.length).to.equal(0);
            expect(res._control._resources.length).to.equal(0);
        });

        it('commit basic control', async function(){
            return this.acl.init()
                .allow('admin')
                .to(['view', 'edit'])
                .on('blog').commit().then((data) => {
                    expect(data.permissions.length).to.equal(1);
                    expect(data.role.name).to.equal('admin');
                }).catch(e => {
                    assert(!e)
                });
        });

        it('commit basic control 2', async function(){
            return this.acl.init()
                .allow('superadmin')
                .to(['*'])
                .on('*').commit().then((data) => {
                    expect(data.permissions.length).to.equal(1);
                    expect(data.role.name).to.equal('superadmin');
                }).catch(e => {
                    assert(!e);
                });
        });
        it('commit basic control 3', async function(){
            return this.acl.init()
                .allow('admin')
                .to(['*'])
                .on(['blog','post','image']).commit().then((data) => {
                    expect(data.permissions.length).to.equal(4);
                    expect(data.role.name).to.equal('admin');
                }).catch(e => {
                    assert(!e);
                });
        });
        it('commit control 4',async function(){
            return this.acl.init()
                .on(['blog','post','image','notice'])
                .allow('moderator')
                .to(['view','edit','update'])
                .commit().then((data) => {
                    expect(data.permissions.length).to.equal(4);
                    expect(data.role.name).to.equal('moderator');
                }).catch(e => {
                    assert(!e);
                });
        });
        it('commit control 5', function(){
            return this.acl.init()
                .on(['blog','post','image','notice'])
                .allow('analyst')
                .to(['view'])
                .commit().then((data) => {
                    expect(data.permissions.length).to.equal(4);
                    expect(data.role.name).to.equal('analyst');
                }).catch(e => {
                    assert(!e);
                });
        });
        it('commit control 6', function(){
            return this.acl.init()
                .on(['blog','post','notice'])
                .allow('user')  
                .to(['view'])
                .commit().then((data) => {
                    expect(data.permissions.length).to.equal(3);
                    expect(data.role.name).to.equal('user');
                }).catch(e => {
                    assert(!e);
                });
        });

    })
}



exports.AclSetup = function(){
    describe('AclSetup', function(){
        
        it('it should assign role to user', async function(){
            let acl = this.acl;
            return  this.acl._sequelize.models.User.findByPk(1).then(function(user){
                return acl.assignRole(user, 'superadmin').then((user)=> {
                    return user.getRoles();
                });
            }).then(roles => {
                expect(roles.length).to.equal(1);
            });
        });
        it('it should assign role to user 2', async function(){
            let acl = this.acl;
            return  this.acl._sequelize.models.User.findByPk(3).then(function(user){
                return acl.assignRole(user, 'moderator').then((user)=> {
                    return user.getRoles();
                });
            }).then(roles => {
                expect(roles.length).to.equal(1);
            }).then(() => {
                return  this.acl._sequelize.models.User.findByPk(4).then(function(user){
                    return acl.assignRole(user, 'user').then((user)=> {
                        return user.getRoles();
                    });                
                }).then(roles => {
                    expect(roles.length).to.equal(1);
                });
            });
        });
        
        
        it('it should assign roles to user', async function(){
            let acl = this.acl;
            return  this.acl._sequelize.models.User.findByPk(2).then(function(user){
                return acl.assignRoles(user, ['superadmin','admin']);
            }).then(roles => {
                expect(roles.length).to.equal(2);
            });
        });
        it('it should remove assigned roles from user', async function(){
            let acl = this.acl;
            return  this.acl._sequelize.models.User.findByPk(2).then(function(user){
                return acl.rmAssignedRoles(user, ['superadmin']).then((res)=> {
                    expect(res).to.equal(1);
                    return user.getRoles();
                });
            }).then(roles => {
                expect(roles.length).to.equal(1);
            });
        });
    })
}

exports.AclAuthorize = function(){
    describe('AclAuthorize', function(){
        
        it('it should allow user to view ', function(){

        });
    })
}





exports.Miscl = function(){

    describe('Miscl', function(){


        if(this.acl2){

        }
    })
}