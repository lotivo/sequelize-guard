'use strict';
var _ = require('lodash');

/**
User Model supercharged with ACL
@namespace AclUser
@alias User

@description Use Same name that you use for your User Model. (we are aliasing User to AclUser)

*/
module.exports = (acl) => {
  const { _models, _options } = acl;
  const AclUser = _options.UserModel || _models.AclUser;

  acl._UserModel = AclUser;

  /**
  @description assign single role to a user.

  @example

  user.assignRole('admin');

   * @param  {string} role - Role to assign
   */
  AclUser.prototype.assignRole = function (role) {
    return acl.assignRole(this, role);
  };

  /**
  @description assign multiple roles to a user.

  @example

  user.assignRoles(['admin','moderator']);

   * @param  {Array} roles - Roles to assign, array of strings
   */
  AclUser.prototype.assignRoles = function (roles) {
    return acl.assignRoles(this, roles);
  };

  /**
    @description remove user from specific roles.

  @example

  user.rmAssignedRoles(['admin','moderator']);


   * @param  {Array} roles - Roles to remove user from
   */
  AclUser.prototype.rmAssignedRoles = function (roles) {
    return acl.rmAssignedRoles(this, roles);
  };

  /**
   *
   * @description Get All the roles  assigned to a user
   * @example
   *  user.roles();
   *  would return ['role1','role2']
   *
   *  @returns {Array} - array of roles
   *
   */
  AclUser.prototype.roles = function () {
    return acl.getUserRoles(this);
  };

  /**
   * Check if a user has ALL of required roles
   *
   * @example
   *
   *  user.isAllOf(['admin','analyst']);
   * @param  {Array} roles - Roles to check for a user
   *
   * @returns {bool} - true if user has ALL of the given roles
   */
  AclUser.prototype.isAllOf = function (roles) {
    return acl.userHasAllRoles(this, roles);
  };

  /**
   * Check if a user has ANY of required roles
   *
   * @param  {Array} roles - Roles to check for a user
   *
   * @example
   * user.isAnyOf(['admin','analyst']);
   *
   * @returns {bool} - true if user has ANY of the given roles
   */
  AclUser.prototype.isAnyOf = function (roles) {
    return acl.userHasRoles(this, roles);
  };

  /**
   * Check if a user has specific role.
   *
   *
    @example

    user.isA('moderator');

   * @param  {string} role - Role to check for a user
   *
   * @returns {bool} - true if user has given role
   */
  AclUser.prototype.isA = function (role) {
    return acl.userIsA(this, role);
  };

  /**
   * Check if a user has specific role.
   * Same as isA(), exists only to give semantic meaning to expression.
   * @function
    @example

    user.isAn('admin');

   * @param  {string} role - Role to check for a user
   *
   * @returns {bool} - true if user has given role
   */
  AclUser.prototype.isAn = AclUser.prototype.isA;

  /**
   * Check if a user has permission to perform specific action.
   *
    @example

    user.can('view blog');

   * @param  {string} permission - Permission to check for a user
   *
   * @returns {bool} - true if user has the given permission
   */
  AclUser.prototype.can = function (permission) {
    return acl.userCan(this, permission);
  };

  /**
   * Check if a user don't have permission to perform specific action.
   *
    @example

    user.can('view blog');

   * @param  {string} permission - Permission to check for a user
   *
   * @returns {bool} - true if user do not have given permission
   */
  AclUser.prototype.cant = function (permission) {
    return acl.userCant(this, permission);
  };
};
