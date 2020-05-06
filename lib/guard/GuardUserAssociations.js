'use strict';
var _ = require('lodash');

/**
User Model supercharged with Guard
@namespace GuardUser
@alias User

@description Use Same name that you use for your User Model. (we are aliasing User to GuardUser)

*/
module.exports = (guard) => {
  const { _models, _options } = guard;
  const GuardUser = _options.UserModel || _models.GuardUser;

  guard._UserModel = GuardUser;

  /**
  @description assign single role to a user.

  @example

  user.assignRole('admin');

   * @param  {string} role - Role to assign
   */
  GuardUser.prototype.assignRole = function (role) {
    return guard.assignRole(this, role);
  };

  /**
  @description assign multiple roles to a user.

  @example

  user.assignRoles(['admin','moderator']);

   * @param  {Array} roles - Roles to assign, array of strings
   */
  GuardUser.prototype.assignRoles = function (roles) {
    return guard.assignRoles(this, roles);
  };

  /**
    @description remove user from specific roles.

  @example

  user.rmAssignedRoles(['admin','moderator']);


   * @param  {Array} roles - Roles to remove user from
   */
  GuardUser.prototype.rmAssignedRoles = function (roles) {
    return guard.rmAssignedRoles(this, roles);
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
  GuardUser.prototype.roles = function () {
    return guard.getUserRoles(this);
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
  GuardUser.prototype.isAllOf = function (roles) {
    return guard.userHasAllRoles(this, roles);
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
  GuardUser.prototype.isAnyOf = function (roles) {
    return guard.userHasRoles(this, roles);
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
  GuardUser.prototype.isA = function (role) {
    return guard.userIsA(this, role);
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
  GuardUser.prototype.isAn = GuardUser.prototype.isA;

  /**
   * Check if a user has permission to perform specific action.
   *
    @example

    user.can('view blog');

   * @param  {string} permission - Permission to check for a user
   *
   * @returns {bool} - true if user has the given permission
   */
  GuardUser.prototype.can = function (permission) {
    return guard.userCan(this, permission);
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
  GuardUser.prototype.cant = function (permission) {
    return guard.userCant(this, permission);
  };
};
