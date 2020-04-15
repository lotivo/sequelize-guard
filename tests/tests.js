// Importing mocha and chai
const mocha = require('mocha')
const chai = require('chai')
var expect = chai.expect;
var assert = chai.assert;

var SequelizeAcl = require('../lib/index');


exports.Constructor = function () {

    // Group of tests using describe
    describe('setup', function () {

        let migration = [];
        let queryInterfaceStub = {
            createTable: function(tableName, schema) {
                migration.push(tableName);
            },
            dropTable: function(tableName, schema) {
                migration.push(tableName);
            }
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
            this.acl.makeUser({name: "Pan", email: "test@test.com" }).then(function(data){
                expect(data.dataValues.name).to.equal('Pan');
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
                    user.rmRoles('admin').then(result => {
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
                    user.rmRoles(['superadmin','moderator','toddle']).then(result => {
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

        it('commit basic control', function(done){
            this.acl.init()
                .allow('admin')
                .to(['view', 'edit'])
                .on('blog').commit().then((data) => {
                    done();
                }).catch(e => {
                    assert(!e)
                    done();
                });
        });

        it('commit basic control 2', function(done){
            this.acl.init()
                .allow('superadmin')
                .to(['*'])
                .on('blog').commit().then((data) => {
                    done();
                }).catch(e => {
                    assert(!e);
                    done();
                });
        });
        it('commit basic control 3', function(done){
            this.acl.init()
                .allow('superadmin')
                .to(['*'])
                .on(['blog','post','image']).commit().then((data) => {
                    done();
                }).catch(e => {
                    assert(!e);
                    done();
                });
        });
        

    })
}

exports.Miscl = function(){

    describe('Miscl', function(){

        if(this.acl2){

        }
    })
}