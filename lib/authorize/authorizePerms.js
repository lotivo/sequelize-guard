const _ = require('lodash');

module.exports = (SequelizeGuard) => {
  /**
   * Get user privileges on specific resource or not
   *
   * @private
   * @param {any}                       user
   * @param {string | undefined | null} resource
   * @name getPrivileges
   */

  SequelizeGuard.prototype.userPrivileges = async function (user, resource) {
    const _guard = this;

    const roles = await _guard.getUserRoles(user);
    let privileges;

    await Promise.all(
      roles.map((role) =>
        _guard
          .getCache()
          .then((cache) => cache.getRolesWithPerms(_guard))
          .then((roles) => roles[role.id].Permissions)
          .then((perms) => {
            if (resource) {
              return perms.find((perm) => perm.resource === resource);
            }
            return perms;
          })
          .then((perm) => {
            if (_.isArray(perm)) {
              privileges = {};
              _.forEach(perm, (permission) => {
                privileges[permission.resource] = permission.privileges;
              });
            } else {
              privileges = perm.privileges;
            }
          })
      )
    );

    return privileges;
  };

  /**
   * Return true if user don't have the permission
   *
   * @private
   * @param {string} user       - Action resource separated by space, eg. 'read
   *   blog'
   * @param {string} permission - Action resource separated by space, eg. 'read
   *   blog'
   * @name can
   */
  SequelizeGuard.prototype.userCant = async function (user, permission) {
    return this.userCan(user, permission).then((result) => !result);
  };

  /**
   * @private
   * @param {string} user       - Action resource separated by space, eg. 'read
   *   blog'
   * @param {string} permission - Action resource separated by space, eg. 'read
   *   blog'
   * @name can
   */
  SequelizeGuard.prototype.userCan = async function (user, permission) {
    let _guard = this;

    let roles = await _guard.getUserRoles(user);

    return firstTrue(
      roles.map((role) =>
        _guard
          .getCache()
          .then((cache) => cache.getRolesWithPerms(_guard))
          .then((roles) => roles[role.id].Permissions)
          .then((perms) => this.resolvePermission(perms, permission))
      )
    );
  };

  /** @private */

  SequelizeGuard.prototype.resolvePermission = function (
    givenPermissions,
    wantedPermission
  ) {
    const allSymbol = '*';
    if (wantedPermission === '*') wantedPermission = '* *';
    const wPerms = wantedPermission.split(' ');
    const wAction = wPerms[0];
    const wResource = wPerms[1];

    let gA = [];
    let gR = [];

    givenPermissions.forEach((p) => {
      gA.push(p.action);
      gR.push(p.resource);
    });

    for (var i = 0; i <= gR.length; i++) {
      if (
        [allSymbol, wResource].includes(gR[i]) &&
        (gA[i].includes('*') || gA[i].includes(wAction))
      ) {
        return true;
      }
    }

    return false;
  };
};

/** @private */

function firstTrue(promises) {
  const newPromises = promises.map((p) => {
    return new Promise((resolve, reject) =>
      p.then((v) => v && resolve(true), reject)
    );
  });
  newPromises.push(Promise.all(promises).then(() => false));
  return Promise.race(newPromises);
}
