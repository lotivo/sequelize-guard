// Importing mocha and chai
const mocha = require('mocha')
const chai = require('chai')
var expect = chai.expect;
var assert = chai.assert;

var SequelizeAcl = require('../lib/index');


exports.Constructor = function () {

    // Group of tests using describe
    describe('setup', function () {
        it('properly runs up migration', function() {
            var migration = [];
            var queryInterfaceStub = {
                createTable: function(tableName, schema) {
                    migration.push(tableName);
                }
            };

            // ['acl_actions', 'acl_resources', 'acl_permissions', 'acl_roles', 'acl_role_user', 'acl_role_permission'  ];
            let expected = SequelizeAcl.migration.tables.map(t => 'acl_'+t);

            SequelizeAcl.migration.up(queryInterfaceStub, this.acl.sequelize, { prefix: 'acl_' });

            assert.deepEqual(migration, expected);
        });
    });
}


exports.Permissions = function(){
    describe('Permissions', function(){
        it('should create permission single action', function(done){

            this.acl.makePermission('blogs','view').then(function(data){
                expect(data.dataValues.name).to.equal('blogs:[view]');
                done();
            }).catch((err)=>{
                console.log(err);

                assert(!err);
                done();
            })
        })
        it('should create permission multiple actions', function(done){
            this.acl.makePermission('blogs',['view','edit']).then(function(data){
                expect(data.dataValues.name).to.equal('blogs:[view,edit]');
                done();
            }).catch((err)=>{
                console.log(err);

                assert(!err);
                done();
            })
        })
        it('should not create duplicate permission', function(done){
            this.acl.makePermission('blogs',['view','edit']).then(function(data){
                expect(!data.dataValues)
                done();
            }).catch((err)=>{
                assert(err);
                done();
            })
        })
    });
}

exports.Roles = function(){
    describe('Roles', function(){

        describe('Create Role(s)', function(){
            it('single: should create role', function(done){
                this.acl.makeRole('admin').then(function(data){
                    expect(data.role.dataValues.name).to.equal('admin');
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
                this.acl.makeRoles(['admin','analyst',{ name:'user', description:"A basic user"}], {all : true}).then(function(data){
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
                this.acl.deleteRoles(['admin', 'moderator']).then(function(data){
                    expect(data).to.equal(1);
                    done();
                }).catch((err)=>{
                    assert(!err);
                    done();
                })
            });
        })


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

            // it('multiple : should remove roles', function(done){
            //     this.acl._sequelize.models.User.findByPk(1).then(function(user){
            //         user.assignRoles(['admin', 'moderator']).then(result =>{
            //             user.getRoles().then(roles => {
            //                 expect(roles.length).to.equal(2);
            //                 done();
            //             })
            //         })
            //     }).catch((err)=>{
            //         console.log(err);
            //         assert(!err);
            //         done();
            //     })
            // });

        });
    });
}

exports.MakeControl = function(){
    describe('MakeControl', function(){
        it('add admin role to control', function(){
            let res = this.acl.make().allow('admin');

            expect(res._roles).to.include('admin');
        });

        it('add view action to control', function(){
            let res = this.acl.to('view');

            expect(res._actions).to.include('view');
        });

        it('add blog resource to control', function(){
            let res = this.acl.on('blog');

            expect(res._resources).to.include('blog');
        });

        // it('commit control', async function(){
        //     await this.acl.allow(['public','mag']).commit(function(data, err){
        //         assert(!err);
        //         // done();
        //     });
        //     // done();
        // });

        // it('dont allow duplicate role', function(done){
        //     this.acl.make().allow(['public']).commit(function(data, err){
        //         assert(err);
        //         done();
        //     });

        // });
    })
}
