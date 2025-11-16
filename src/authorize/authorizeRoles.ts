import { includes } from 'lodash';
import { GuardUserModel } from '../sequelize-models';

declare module '../SequelizeGuard' {
  interface SequelizeGuard {
    userHasRoles(user: GuardUserModel, roles: string[]): Promise<boolean>;
    userHasAllRoles(user: GuardUserModel, roles: string[]): Promise<boolean>;
    userIsA(user: GuardUserModel, role: string): Promise<boolean>;
  }
}

/**
 * Extend SequelizeGuard with role-based authorization
 */
export function extendWithAuthorizeRoles(
  SequelizeGuard: typeof import('../SequelizeGuard').SequelizeGuard,
): void {
  /**
   * Check if user has any of the given roles
   */
  SequelizeGuard.prototype.userHasRoles = async function (
    user: GuardUserModel,
    roles: string[],
  ): Promise<boolean> {
    const userRoles = await this.getUserRoles(user);
    const uRoles = userRoles.map((r) => r.name);
    const checks = uRoles.map((r) => includes(roles, r));
    return includes(checks, true);
  };

  /**
   * Check if user has all of the given roles
   */
  SequelizeGuard.prototype.userHasAllRoles = async function (
    user: GuardUserModel,
    roles: string[],
  ): Promise<boolean> {
    const userRoles = await this.getUserRoles(user);
    const uRoles = userRoles.map((r) => r.name);

    const checks =
      uRoles.length >= roles.length
        ? uRoles.map((r) => includes(roles, r))
        : roles.map((r) => includes(uRoles, r));

    return !includes(checks, false);
  };

  /**
   * Check if user has a specific role
   */
  SequelizeGuard.prototype.userIsA = async function (
    user: GuardUserModel,
    role: string,
  ): Promise<boolean> {
    const userRoles = await this.getUserRoles(user);
    const checks = userRoles.map((r) => role === r.name);
    return includes(checks, true);
  };
}
