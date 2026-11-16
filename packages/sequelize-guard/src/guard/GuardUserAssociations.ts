import type { Model, ModelStatic } from 'sequelize';
import type { GuardUserModel } from '../sequelize-models';
import type { SequelizeGuard } from '../SequelizeGuard';

export function guardUserMethods(guard: SequelizeGuard) {
  return {
    assignRole(this: GuardUserModel, role: string) {
      return guard.assignRole(this, role);
    },
    roles(this: GuardUserModel) {
      return this.getRoles!({ useMaster: true, transaction: null });
    },
    assignRoles(this: GuardUserModel, roles: string[]) {
      return guard.assignRoles(this, roles);
    },
    rmAssignedRoles(this: GuardUserModel, roles: string[]) {
      return guard.rmAssignedRoles(this, roles);
    },
    isAllOf(this: GuardUserModel, roles: string[]) {
      return guard.userHasAllRoles(this, roles);
    },
    isAnyOf(this: GuardUserModel, roles: string[]) {
      return guard.userHasRoles(this, roles);
    },
    isA(this: GuardUserModel, role: string) {
      return guard.userIsA(this, role);
    },
    isAn(this: GuardUserModel, role: string) {
      return guard.userIsA(this, role);
    },
    can(this: GuardUserModel, permission: string) {
      return guard.userCan(this, permission);
    },
    cant(this: GuardUserModel, permission: string) {
      return guard.userCant(this, permission);
    },
  };
}

export function assertGuardUserAssociations(
  user: ModelStatic<Model>,
  methods: ReturnType<typeof guardUserMethods>,
): void {
  if (
    !Object.isExtensible(user.prototype) ||
    !Object.isExtensible(user.associations)
  ) {
    throw new Error(
      `Cannot add guard associations to UserModel "${user.name}"`,
    );
  }
  const members = [
    ...Object.keys(methods),
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
  ];
  const attributes = user.getAttributes();
  const conflict = members.find(
    (name) =>
      name in user.prototype ||
      Object.hasOwn(attributes, name) ||
      Object.hasOwn(user.associations, name),
  );
  if (conflict) {
    throw new Error(`UserModel "${user.name}" already defines "${conflict}"`);
  }
}
