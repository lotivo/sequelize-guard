import type { Model, ModelStatic } from 'sequelize';
import type { GuardUserMethods } from '../sequelize-models';
import type { SequelizeGuardInstance } from '../SequelizeGuard';

export function guardUserMethods(guard: SequelizeGuardInstance) {
  return {
    assignRole(this: Model & GuardUserMethods, role: string) {
      return guard.assignRole(this, role);
    },
    roles(this: Model & GuardUserMethods) {
      return this.getRoles({ useMaster: true, transaction: null });
    },
    assignRoles(this: Model & GuardUserMethods, roles: string[]) {
      return guard.assignRoles(this, roles);
    },
    rmAssignedRoles(this: Model & GuardUserMethods, roles: string[]) {
      return guard.rmAssignedRoles(this, roles);
    },
    isAllOf(this: Model & GuardUserMethods, roles: string[]) {
      return guard.userHasAllRoles(this, roles);
    },
    isAnyOf(this: Model & GuardUserMethods, roles: string[]) {
      return guard.userHasRoles(this, roles);
    },
    isA(this: Model & GuardUserMethods, role: string) {
      return guard.userIsA(this, role);
    },
    isAn(this: Model & GuardUserMethods, role: string) {
      return guard.userIsA(this, role);
    },
    can(this: Model & GuardUserMethods, permission: string) {
      return guard.userCan(this, permission);
    },
    cant(this: Model & GuardUserMethods, permission: string) {
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
