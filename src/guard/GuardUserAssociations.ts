import { isObjectLike } from 'lodash';
import { GuardUserModel } from '../sequelize-models';
import type { SequelizeGuard } from '../SequelizeGuard';

/**
 * Setup associations and methods on User model
 * @param guard
 */
export function setupGuardUserAssociations(guard: SequelizeGuard): void {
  const { GuardUser } = guard._models;
  // (guard as any)._UserModel = GuardUser;

  Object.defineProperty(GuardUser.prototype, 'assignRole', {
    value: function (role: string) {
      return guard.assignRole(this, role);
    },
  });

  Object.defineProperty(GuardUser, 'assignRoles', {
    value: function (roles: string[]) {
      return guard.assignRoles(this, roles);
    },
  });

  Object.defineProperty(GuardUser.prototype, 'rmAssignedRoles', {
    value: function (roles: string[]) {
      return guard.rmAssignedRoles(this, roles);
    },
  });

  Object.defineProperty(GuardUser.prototype, 'roles', {
    value: function () {
      return guard.getUserRoles(this);
    },
  });

  Object.defineProperty(GuardUser.prototype, 'isAllOf', {
    value: function (roles: string[]) {
      return guard.userHasAllRoles(this, roles);
    },
  });

  Object.defineProperty(GuardUser.prototype, 'isAnyOf', {
    value: function (roles: string[]) {
      return guard.userHasRoles(this, roles);
    },
  });

  Object.defineProperty(GuardUser.prototype, 'isA', {
    value: function (role: string) {
      return guard.userIsA(this, role);
    },
  });

  Object.defineProperty(GuardUser.prototype, 'isAn', {
    value: function (role: string) {
      return guard.userIsA(this, role);
    },
  });

  Object.defineProperty(GuardUser.prototype, 'can', {
    value: function (permission: string) {
      return guard.userCan(this, permission);
    },
  });

  Object.defineProperty(GuardUser.prototype, 'cant', {
    value: function (permission: string) {
      return guard.userCant(this, permission);
    },
  });
}

/**
 * Assign single role to user
 */
// GuardUser.prototype.assignRole = function (
//   this: GuardUserModel,
//   role: string,
// ) {
//   return guard.assignRole(this, role);
// };

/**
 * Assign multiple roles to user
 */
// (GuardUser as any).prototype.assignRoles = function (
//   this: GuardUserModel,
//   roles: string[],
// ) {
//   return guard.assignRoles(this, roles);
// };

/**
 * Remove assigned roles from user
 */
// (GuardUser as any).prototype.rmAssignedRoles = function (
//   this: GuardUserModel,
//   roles: string[],
// ) {
//   return guard.rmAssignedRoles(this, roles);
// };

// /**
//  * Get all roles assigned to user
//  */
// (GuardUser as any).prototype.roles = function (this: GuardUserModel) {
//   return guard.getUserRoles(this);
// };

// /**
//  * Check if user has all of the given roles
//  */
// (GuardUser as any).prototype.isAllOf = function (
//   this: GuardUserModel,
//   roles: string[],
// ) {
//   return guard.userHasAllRoles(this, roles);
// };

// /**
//  * Check if user has any of the given roles
//  */
// (GuardUser as any).prototype.isAnyOf = function (
//   this: GuardUserModel,
//   roles: string[],
// ) {
//   return guard.userHasRoles(this, roles);
// };

// /**
//  * Check if user has a specific role
//  */
// (GuardUser as any).prototype.isA = function (
//   this: GuardUserModel,
//   role: string,
// ) {
//   return guard.userIsA(this, role);
// };

// /**
//  * Alias for isA
//  */
// (GuardUser as any).prototype.isAn = (GuardUser as any).prototype.isA;

// /**
//  * Check if user can perform action
//  */
// (GuardUser as any).prototype.can = function (
//   this: GuardUserModel,
//   permission: string,
// ) {
//   return guard.userCan(this, permission);
// };

// /**
//  * Check if user cannot perform action
//  */
// (GuardUser as any).prototype.cant = function (
//   this: GuardUserModel,
//   permission: string,
// ) {
//   return guard.userCant(this, permission);
// };
// }
