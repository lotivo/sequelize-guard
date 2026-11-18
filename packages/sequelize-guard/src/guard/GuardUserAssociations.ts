import type { Model, ModelStatic } from 'sequelize';
import type { GuardUserModel, GuardUserModelStatic } from '../sequelize-models';
import type { SequelizeGuard } from '../SequelizeGuard';

/** Validate application model surfaces before Sequelize adds associations or methods. */
export function assertGuardUserAssociations(user: ModelStatic<Model>): void {
  if (
    !Object.isExtensible(user.prototype) ||
    !Object.isExtensible(user.associations)
  )
    throw new Error(
      `Cannot add guard associations to UserModel "${user.name}"`,
    );
  const names = [
    'Roles',
    'getRoles',
    'setRoles',
    'addRoles',
    'addRole',
    'createRole',
    'removeRole',
    'removeRoles',
    'hasRole',
    'hasRoles',
    'countRoles',
    'assignRole',
    'roles',
    'assignRoles',
    'rmAssignedRoles',
    'isAllOf',
    'isAnyOf',
    'isA',
    'isAn',
    'can',
    'cant',
  ];
  const attrs = user.getAttributes();
  const conflict = names.find(
    (name) =>
      name in user.prototype ||
      Object.hasOwn(attrs, name) ||
      Object.hasOwn(user.associations, name),
  );
  if (conflict)
    throw new Error(`UserModel "${user.name}" already defines "${conflict}"`);
}

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

  (GuardUser.prototype as GuardUserModel).roles = function (
    this: GuardUserModel,
  ) {
    return this.getRoles!();
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
