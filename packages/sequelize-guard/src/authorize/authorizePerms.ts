import { Op } from 'sequelize';
import { GuardUserModel } from '../sequelize-models';
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
    user: GuardUserModel,
    permission: string,
  ): Promise<boolean> {
    const requested = parsePermissionRequest(permission);
    if (!requested) return false;
    // Keep the membership and matching grants in one writer-backed read.
    const roles = await this._readCommitted(() =>
      user.getRoles!({
        include: [
          {
            association: 'Permissions',
            required: false,
            where: { resource: { [Op.in]: [requested.resource, '*'] } },
          },
        ],
        useMaster: true,
        transaction: null,
      }),
    );
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
    user: GuardUserModel,
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
