'use strict';
var _ = require('lodash')
var Sequelize = require('sequelize');

const Op = Sequelize.Op;

module.exports = (acl) => {

    const { _models, _options, _sequelize} = acl;
    const { AclResource, AclRole, AclPermission, RolePermission, RoleUser } = _models;
    const AclUser = _options.UserModel || _models.AclUser;

    AclUser.prototype.assignRole = function(role){
        var _user = this;

        return acl.makeRole(role).then(({role, created})=>{
            return _user.setRoles(role).then((d)=>{
                return _user;
            });
        }).catch(err => console.log(err));
    }
    AclUser.prototype.assignRoles = function(roles){
        var _user = this;

        return acl.makeRoles(roles, { all : true} ).then((allRoles)=>{
            return _user.getRoles().then((assignedRoles)=> {
                return _.differenceBy(allRoles, assignedRoles, (r) => r.name)
            });
        }).then((roles2insert) => {
            return _user.addRoles(roles2insert);
        }).catch(err => console.log(err));
    }

    AclUser.prototype.rmRoles = function(roles){
        var _user = this;

        if (typeof roles === 'string') roles = [roles];

        return AclRole.findAll({where: {name : {[Op.in] : roles}}}).then((roles)=>{
            return _user.removeRoles(roles);
        });
    }




}
