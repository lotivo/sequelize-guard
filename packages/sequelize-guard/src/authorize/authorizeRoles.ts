import lodash from 'lodash';
import { GuardUserModel } from '../sequelize-models';
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
    user: GuardUserModel,
    roles: string[],
  ): Promise<boolean> {
    const userRoles = await this.getUserRoles(user);
    const uRoles = userRoles.map((r) => r.name);
    const checks = uRoles.map((r) => lodash.includes(roles, r));
    return lodash.includes(checks, true);
  };

  /**
   * Check if user has all of the given roles
   * @param user
   * @param roles
   */
  SequelizeGuard.prototype.userHasAllRoles = async function (
    user: GuardUserModel,
    roles: string[],
  ): Promise<boolean> {
    const userRoles = await this.getUserRoles(user);
    const uRoles = userRoles.map((r) => r.name);

    return roles.every((role) => uRoles.includes(role));
  };

  /**
   * Check if user has a specific role
   * @param user
   * @param role
   */
  SequelizeGuard.prototype.userIsA = async function (
    user: GuardUserModel,
    role: string,
  ): Promise<boolean> {
    const userRoles = await this.getUserRoles(user);
    const checks = userRoles.map((r) => role === r.name);
    return lodash.includes(checks, true);
  };
}
