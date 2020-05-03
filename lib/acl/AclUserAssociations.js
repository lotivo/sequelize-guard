'use strict';
var _ = require('lodash');

module.exports = (acl) => {
  const { _models, _options } = acl;
  const AclUser = _options.UserModel || _models.AclUser;

  acl._UserModel = AclUser;

  AclUser.prototype.assignRole = function (role) {
    return acl.assignRole(this, role);
  };

  AclUser.prototype.assignRoles = function (roles) {
    return acl.assignRoles(this, roles);
  };

  AclUser.prototype.rmAssignedRoles = function (roles) {
    return acl.rmAssignedRoles(this, roles);
  };

  AclUser.prototype.roles = function () {
    return acl.getUserRoles(this);
  };

  AclUser.prototype.isAllOf = function (roles) {
    return acl.userHasAllRoles(this, roles);
  };

  AclUser.prototype.isAnyOf = function (roles) {
    return acl.userHasRoles(this, roles);
  };

  AclUser.prototype.isA = function (role) {
    return acl.userIsA(this, role);
  };
  AclUser.prototype.isAn = AclUser.prototype.isA;

  AclUser.prototype.can = function (permission) {
    return acl.userCan(this, permission);
  };

  AclUser.prototype.cant = function (permission) {
    return acl.userCant(this, permission);
  };
};
