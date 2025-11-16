import { differenceBy } from 'lodash';
import { Op } from 'sequelize';
import { GuardRoleSerializable, GuardUserModel } from '../sequelize-models';

declare module '../SequelizeGuard' {
  interface SequelizeGuard {
    makeUser(): Promise<GuardUserModel>;
    assignRole(user: GuardUserModel, role: string): Promise<GuardUserModel>;
    assignRoles(user: GuardUserModel, roles: string[]): Promise<void>;
    rmAssignedRoles(user: GuardUserModel, roles: string[]): Promise<void>;
    getUserRoles(user: GuardUserModel): Promise<any[]>;
  }
}

/**
 * Extend SequelizeGuard with user management methods
 */
export function extendWithUsers(
  SequelizeGuard: typeof import('../SequelizeGuard').SequelizeGuard,
): void {
  /**
   * Make/create a user
   */
  SequelizeGuard.prototype.makeUser =
    async function (): Promise<GuardUserModel> {
      return this._models.GuardUser.create({});
    };

  /**
   * Assign role to user
   */
  SequelizeGuard.prototype.assignRole = async function (
    user: GuardUserModel,
    role: string,
  ): Promise<GuardUserModel> {
    const { role: roleModel } = await this.makeRole(role);
    await user.addRole!(roleModel.id);
    return user;
  };

  /**
   * Assign multiple roles to user
   */
  SequelizeGuard.prototype.assignRoles = async function (
    user: GuardUserModel,
    roles: string[],
  ): Promise<void> {
    const allRoles = await this.makeRoles(roles, { all: true });
    const assignedRoles = await user.getRoles!();
    const roles2insert = differenceBy(allRoles, assignedRoles, (r) => r.name);
    await user.addRoles!(roles2insert.map((r) => r.id));
  };

  /**
   * Remove roles from user
   */
  SequelizeGuard.prototype.rmAssignedRoles = async function (
    user: GuardUserModel,
    roles: string[],
  ): Promise<void> {
    const rolesToRemove = await this._models.GuardRole.findAll({
      where: { name: { [Op.in]: roles } },
    });
    await user.removeRoles!(rolesToRemove);
  };

  /**
   * Get user roles with caching
   */
  SequelizeGuard.prototype.getUserRoles = async function (
    user: GuardUserModel,
  ): Promise<any[]> {
    const cacheKey = `user_${user.get(this.options.userPk)}`;
    const cache = this.getUserCache();

    let cacheRoles: GuardRoleSerializable[] | undefined = undefined;
    if (this.options.userCache) {
      cacheRoles = cache.get<GuardRoleSerializable[]>(cacheKey);
    }

    if (cacheRoles) {
      return cacheRoles;
    }

    const fetchedRoles = await user.getRoles!();
    const jsonRoles = fetchedRoles.map((perm) => perm.toJSON());

    if (this.options.userCache) {
      cache.set(cacheKey, jsonRoles, this.options.userCacheTtl);
    }

    return jsonRoles;
  };
}
