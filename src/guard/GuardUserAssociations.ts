import type { GuardUserModel, GuardUserModelStatic } from '../sequelize-models';
import type { SequelizeGuard } from '../SequelizeGuard';

/**
 * Setup associations and methods on User model
 * @param guard
 */
/**
 * Setup associations and methods on User model
 *
 * @export
 * @param {SequelizeGuard} guard
 */
export function setupGuardUserAssociations(
  guard: SequelizeGuard,
): GuardUserModelStatic {
  const { GuardUser } = guard._models;

  (GuardUser.prototype as GuardUserModel).assignRole = function (
    this: GuardUserModel,
    role: string,
  ) {
    return guard.assignRole(this, role);
  };

  (GuardUser.prototype as GuardUserModel).assignRoles = function (
    this: GuardUserModel,
    roles: string[],
  ) {
    return guard.assignRoles(this, roles);
  };

  (GuardUser.prototype as GuardUserModel).rmAssignedRoles = function (
    this: GuardUserModel,
    roles: string[],
  ) {
    return guard.rmAssignedRoles(this, roles);
  };

  (GuardUser.prototype as GuardUserModel).isAllOf = function (
    this: GuardUserModel,
    roles: string[],
  ) {
    return guard.userHasAllRoles(this, roles);
  };

  (GuardUser.prototype as GuardUserModel).isAnyOf = function (
    this: GuardUserModel,
    roles: string[],
  ) {
    return guard.userHasRoles(this, roles);
  };

  (GuardUser.prototype as GuardUserModel).isA = function (
    this: GuardUserModel,
    role: string,
  ) {
    return guard.userIsA(this, role);
  };

  (GuardUser.prototype as GuardUserModel).isAn = function (
    this: GuardUserModel,
    role: string,
  ) {
    return guard.userIsA(this, role);
  };

  (GuardUser.prototype as GuardUserModel).can = function (
    this: GuardUserModel,
    permission: string,
  ) {
    return guard.userCan(this, permission);
  };

  (GuardUser.prototype as GuardUserModel).cant = function (
    this: GuardUserModel,
    permission: string,
  ) {
    return guard.userCant(this, permission);
  };

  return GuardUser;
}
