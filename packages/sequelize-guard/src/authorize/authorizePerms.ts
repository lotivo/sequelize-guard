import type { Model } from 'sequelize';
import { getPolicyUser, userMemberships } from '../guard/Users';
import type { SequelizeGuardType } from '../SequelizeGuard';
import {
  isPermissionToken,
  parsePermissionRequest,
  readPermissionActions,
} from './permissionGrammar';
import { readMemberPermissions } from './roleMembershipQuery';

/**
 * Extend SequelizeGuard with permission-based authorization
 * @param SequelizeGuard
 */
export function extendWithAuthorizePerms(
  SequelizeGuard: SequelizeGuardType,
): void {
  /**
   * Check if user has permission
   * @param user
   * @param permission
   */
  SequelizeGuard.prototype.userCan = async function (
    user: Model,
    permission: string,
  ): Promise<boolean> {
    if (!parsePermissionRequest(permission)) return false;

    const permissions = await readMemberPermissions(
      this,
      userMemberships(this),
      getPolicyUser(this, user),
    );
    return this.resolvePermission(permissions, permission);
  };

  /**
   * Check if user doesn't have permission
   * @param user
   * @param permission
   */
  SequelizeGuard.prototype.userCant = async function (
    user: Model,
    permission: string,
  ): Promise<boolean> {
    return this.userCan(user, permission).then((result) => !result);
  };

  /**
   * Resolve permission from given permissions
   * @param givenPermissions
   * @param wantedPermission
   */
  SequelizeGuard.prototype.resolvePermission = function (
    givenPermissions,
    wantedPermission,
  ) {
    const requested = parsePermissionRequest(wantedPermission);
    if (!requested) return false;

    return givenPermissions.some(({ resource, action }) => {
      if (
        !isPermissionToken(resource) ||
        (resource !== '*' && resource !== requested.resource)
      ) {
        return false;
      }
      const actions = readPermissionActions(action);
      return (
        actions !== null &&
        (actions.includes('*') || actions.includes(requested.action))
      );
    });
  };
}
