import type { SequelizeGuard } from '../SequelizeGuard';
import type { GuardUserModel } from '../types';

/**
 * Setup associations and methods on User model
 */
export function setupGuardUserAssociations(guard: SequelizeGuard): void {
  const GuardUser = guard.options.UserModel || guard._models.GuardUser;
  (guard as any)._UserModel = GuardUser;

  /**
   * Assign single role to user
   */
  (GuardUser as any).prototype.assignRole = function (
    this: GuardUserModel,
    role: string,
  ) {
    return guard.assignRole(this, role);
  };

  /**
   * Assign multiple roles to user
   */
  (GuardUser as any).prototype.assignRoles = function (
    this: GuardUserModel,
    roles: string[],
  ) {
    return guard.assignRoles(this, roles);
  };

  /**
   * Remove assigned roles from user
   */
  (GuardUser as any).prototype.rmAssignedRoles = function (
    this: GuardUserModel,
    roles: string[],
  ) {
    return guard.rmAssignedRoles(this, roles);
  };

  /**
   * Get all roles assigned to user
   */
  (GuardUser as any).prototype.roles = function (this: GuardUserModel) {
    return guard.getUserRoles(this);
  };

  /**
   * Check if user has all of the given roles
   */
  (GuardUser as any).prototype.isAllOf = function (
    this: GuardUserModel,
    roles: string[],
  ) {
    return guard.userHasAllRoles(this, roles);
  };

  /**
   * Check if user has any of the given roles
   */
  (GuardUser as any).prototype.isAnyOf = function (
    this: GuardUserModel,
    roles: string[],
  ) {
    return guard.userHasRoles(this, roles);
  };

  /**
   * Check if user has a specific role
   */
  (GuardUser as any).prototype.isA = function (
    this: GuardUserModel,
    role: string,
  ) {
    return guard.userIsA(this, role);
  };

  /**
   * Alias for isA
   */
  (GuardUser as any).prototype.isAn = (GuardUser as any).prototype.isA;

  /**
   * Check if user can perform action
   */
  (GuardUser as any).prototype.can = function (
    this: GuardUserModel,
    permission: string,
  ) {
    return guard.userCan(this, permission);
  };

  /**
   * Check if user cannot perform action
   */
  (GuardUser as any).prototype.cant = function (
    this: GuardUserModel,
    permission: string,
  ) {
    return guard.userCant(this, permission);
  };
}
