import type { GuardUserModel, GuardUserModelStatic } from '../sequelize-models';
import type { SequelizeGuard } from '../SequelizeGuard';

/**
 * Setup associations and methods on User model
 * @param guard
 */
/**
 * Description placeholder
 *
 * @export
 * @param {SequelizeGuard} guard
 */
export function setupGuardUserAssociations(
  guard: SequelizeGuard,
): GuardUserModelStatic {
  const { GuardUser } = guard._models;

  /**
   * Assign single role to user
   */
  Object.defineProperty(GuardUser.prototype, 'assignRole', {
    value: function (this: GuardUserModel, role: string) {
      return guard.assignRole(this, role);
    },
  });

  /**
   * Assign multiple roles to user
   */
  Object.defineProperty(GuardUser, 'assignRoles', {
    value: function (this: GuardUserModel, roles: string[]) {
      return guard.assignRoles(this, roles);
    },
  });

  /**
   * Remove assigned roles from user
   */
  Object.defineProperty(GuardUser.prototype, 'rmAssignedRoles', {
    value: function (this: GuardUserModel, roles: string[]) {
      return guard.rmAssignedRoles(this, roles);
    },
  });

  /**
   * Get all roles assigned to user
   */
  Object.defineProperty(GuardUser.prototype, 'roles', {
    value: function (this: GuardUserModel) {
      return guard.getUserRoles(this);
    },
  });

  /**
   * Check if user has all of the given roles
   */
  Object.defineProperty(GuardUser.prototype, 'isAllOf', {
    value: function (this: GuardUserModel, roles: string[]) {
      return guard.userHasAllRoles(this, roles);
    },
  });

  /**
   * Check if user has any of the given roles
   */
  Object.defineProperty(GuardUser.prototype, 'isAnyOf', {
    value: function (this: GuardUserModel, roles: string[]) {
      return guard.userHasRoles(this, roles);
    },
  });

  /**
   * Check if user has a specific role
   */
  Object.defineProperty(GuardUser.prototype, 'isA', {
    value: function (this: GuardUserModel, role: string) {
      return guard.userIsA(this, role);
    },
  });

  /**
   * Alias for isA
   */
  Object.defineProperty(GuardUser.prototype, 'isAn', {
    value: function (this: GuardUserModel, role: string) {
      return guard.userIsA(this, role);
    },
  });

  /**
   * Check if user can perform action
   */
  Object.defineProperty(GuardUser.prototype, 'can', {
    value: function (this: GuardUserModel, permission: string) {
      return guard.userCan(this, permission);
    },
  });

  /**
   *  Check if user cannot perform action
   */
  Object.defineProperty(GuardUser.prototype, 'cant', {
    value: function (this: GuardUserModel, permission: string) {
      return guard.userCant(this, permission);
    },
  });

  return GuardUser;
}
