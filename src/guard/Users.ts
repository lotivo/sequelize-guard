import { differenceBy } from 'lodash';
import { Op } from 'sequelize';
import type { SequelizeGuard } from '../SequelizeGuard';
import type { GuardUserModel, GuardRoleModel, UserInput } from '../types';

declare module '../SequelizeGuard' {
  interface SequelizeGuard {
    makeUser(user: UserInput): Promise<GuardUserModel>;
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
  SequelizeGuard.prototype.makeUser = async function (
    user: UserInput,
  ): Promise<GuardUserModel> {
    return this._models.GuardUser.create({
      name: user.name,
      email: user.email,
    } as any) as Promise<GuardUserModel>;
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
    const roles2insert = differenceBy(
      allRoles,
      assignedRoles,
      (r: any) => r.name,
    );
    await user.addRoles!(roles2insert.map((r: any) => r.id));
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
    await user.removeRoles!(rolesToRemove as any);
  };

  /**
   * Get user roles with caching
   */
  SequelizeGuard.prototype.getUserRoles = async function (
    user: GuardUserModel,
  ): Promise<any[]> {
    const cacheKey = `user_${(user as any)[this.options.userPk]}`;
    const cache = await (this as any).getUserCache();

    let cacheRoles;
    if (this.options.userCache) {
      cacheRoles = cache.get(cacheKey);
    }

    if (cacheRoles) return cacheRoles;

    const fetchedRoles = await user.getRoles!();
    const jsonRoles = fetchedRoles.map((perm: any) => perm.toJSON());

    if (this.options.userCache) {
      cache.set(cacheKey, jsonRoles, this.options.userCacheTtl);
    }

    return jsonRoles;
  };
}
