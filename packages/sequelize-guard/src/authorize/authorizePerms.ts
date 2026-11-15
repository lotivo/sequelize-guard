import type { Model } from 'sequelize';
import { getPolicyUser } from '../guard/Users';
import type { SequelizeGuardType } from '../SequelizeGuard';
import {
  isPermissionToken,
  parsePermissionRequest,
  readPermissionActions,
} from './permissionGrammar';

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

    // Read membership and policy together from the writer, never from local snapshots.
    const roles = await getPolicyUser(this, user).getRoles!({
      include: ['Permissions'],
      useMaster: true,
      transaction: null,
    });
    return roles.some((role) =>
      this.resolvePermission(role.Permissions ?? [], permission),
    );
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
