import type { Model } from 'sequelize';
import { normalizeRoleName } from '../guard/Roles';
import type { SequelizeGuardType } from '../SequelizeGuard';

/**
 * Extend SequelizeGuard with role-based authorization
 * @param SequelizeGuard
 */
export function extendWithAuthorizeRoles(
  SequelizeGuard: SequelizeGuardType,
): void {
  /**
   * Check if user has `any` of the given roles
   * @param user
   * @param roles
   */
  SequelizeGuard.prototype.userHasRoles = async function (
    user: Model,
    roles: string[],
  ): Promise<boolean> {
    const names = new Set(roles.map(normalizeRoleName));
    const userRoles = await this.getUserRoles(user);
    return userRoles.some(({ name }) => names.has(name));
  };

  /**
   * Check if user has all of the given roles
   * @param user
   * @param roles
   */
  SequelizeGuard.prototype.userHasAllRoles = async function (
    user: Model,
    roles: string[],
  ): Promise<boolean> {
    const names = roles.map(normalizeRoleName);
    const userRoles = new Set(
      (await this.getUserRoles(user)).map(({ name }) => name),
    );
    return names.every((name) => userRoles.has(name));
  };

  /**
   * Check if user has a specific role
   * @param user
   * @param role
   */
  SequelizeGuard.prototype.userIsA = async function (
    user: Model,
    role: string,
  ): Promise<boolean> {
    const name = normalizeRoleName(role);
    const userRoles = await this.getUserRoles(user);
    return userRoles.some((role) => role.name === name);
  };
}
