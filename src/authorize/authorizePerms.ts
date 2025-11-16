import { GuardUserModel } from '../sequelize-models';

declare module '../SequelizeGuard' {
  interface SequelizeGuard {
    userCan(user: GuardUserModel, permission: string): Promise<boolean>;
    userCant(user: GuardUserModel, permission: string): Promise<boolean>;
    resolvePermission(
      givenPermissions: any[],
      wantedPermission: string,
    ): boolean;
  }
}

/**
 * Extend SequelizeGuard with permission-based authorization
 */
export function extendWithAuthorizePerms(
  SequelizeGuard: typeof import('../SequelizeGuard').SequelizeGuard,
): void {
  /**
   * Check if user has permission
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
          .then((perms) => this.resolvePermission(perms, permission)),
      ),
    );
  };

  /**
   * Check if user doesn't have permission
   */
  SequelizeGuard.prototype.userCant = async function (
    user: GuardUserModel,
    permission: string,
  ): Promise<boolean> {
    return this.userCan(user, permission).then((result) => !result);
  };

  /**
   * Resolve permission from given permissions
   */
  SequelizeGuard.prototype.resolvePermission = function (
    givenPermissions: any[],
    wantedPermission: string,
  ): boolean {
    const allSymbol = '*';
    if (wantedPermission === '*') wantedPermission = '* *';

    const wPerms = wantedPermission.split(' ');
    const wAction = wPerms[0];
    const wResource = wPerms[1];

    const gA: string[][] = [];
    const gR: string[] = [];

    givenPermissions.forEach((p) => {
      gA.push(JSON.parse(p.action));
      gR.push(p.resource);
    });

    for (let i = 0; i <= gR.length; i++) {
      if (
        (gR[i] === allSymbol &&
          (gA[i].includes('*') || gA[i].includes(wAction))) ||
        (gR[i] === wResource &&
          (gA[i].includes('*') || gA[i].includes(wAction)))
      ) {
        return true;
      }
    }

    return false;
  };
}

/**
 * Helper function to return true if any promise resolves to true
 */
function firstTrue(promises: Promise<boolean>[]): Promise<boolean> {
  const newPromises = promises.map((p) => {
    return new Promise<boolean>((resolve, reject) =>
      p.then((v) => v && resolve(true), reject),
    );
  });
  newPromises.push(Promise.all(promises).then(() => false));
  return Promise.race(newPromises);
}
