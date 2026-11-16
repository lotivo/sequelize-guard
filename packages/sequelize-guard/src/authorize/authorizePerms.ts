import { GuardUserModel } from '../sequelize-models';
import type { SequelizeGuardType } from '../SequelizeGuard';

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
    this._assertModelBindings();
    // Read membership and policy together from the writer, never from local snapshots.
    const roles = await user.getRoles!({
      include: ['Permissions'],
      useMaster: true,
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
    const allSymbol = '*';
    if (wantedPermission === '*') wantedPermission = '* *';

    const wPerms = wantedPermission.split(' ');
    const wAction = wPerms[0];
    const wResource = wPerms[1];

    const gActions: string[][] = [];
    const gResources: string[] = [];

    givenPermissions.forEach((p) => {
      gActions.push(JSON.parse(p.action) as string[]);
      gResources.push(p.resource);
    });

    for (let i = 0; i <= gResources.length; i++) {
      if (
        (gResources[i] === allSymbol &&
          (gActions[i]?.includes('*') || gActions[i]?.includes(wAction))) ||
        (gResources[i] === wResource &&
          (gActions[i]?.includes('*') || gActions[i]?.includes(wAction)))
      ) {
        return true;
      }
    }

    return false;
  };
}
