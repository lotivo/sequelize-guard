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
    const roles = await this.getUserRoles(user);

    return firstTrue(
      roles.map((role) =>
        this.getCache()
          .then((cache) => cache.getRolesWithPerms(this))
          .then((roles) => roles[role.id].Permissions)
          .then((perms) => {
            if (!perms) {
              return false;
            }

            return this.resolvePermission(perms, permission);
          }),
      ),
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

/**
 * Helper function to return true if any promise resolves to true
 * @param promises
 */
function firstTrue(promises: Promise<boolean>[]): Promise<boolean> {
  const newPromises = promises.map((p) => {
    return new Promise<boolean>((resolve, reject) => {
      void p.then((v) => v && resolve(true), reject);
    });
  });
  newPromises.push(Promise.all(promises).then(() => false));
  return Promise.race(newPromises);
}
