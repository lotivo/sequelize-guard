var _ = require('lodash');

module.exports = (SequelizeAcl) => {
  /**
  @private

   * @name can
   ** Return true if user don't have the permission

   * @param {string} user - action resource separated by space, eg. 'read blog'
   * @param {string} permission - action resource separated by space, eg. 'read blog'
   */
  SequelizeAcl.prototype.userCant = async function (user, permissionAsked) {
    return this.userCan(user, permissionAsked).then((result) => !result);
  };

  /**
    @private

   * @name can
   *
   * @param {string} user - action resource separated by space, eg. 'read blog'
   * @param {string} permission - action resource separated by space, eg. 'read blog'
   */
  SequelizeAcl.prototype.userCan = async function (user, permissionAsked) {
    let _acl = this;

    let roles = await _acl.getUserRoles(user);

    return firstTrue(
      roles.map((role) =>
        _acl
          .getCache()
          .then((cache) => cache.getRolesWithPerms(_acl))
          .then((roles) => roles[role.id].Permissions)
          .then((perms) => this.resolvePermission(perms, permissionAsked))
      )
    );
  };

  /**
  @private
  */

  SequelizeAcl.prototype.resolvePermission = function (
    givenPermissions,
    wantedPermission
  ) {
    const allSymbol = '*';
    if (wantedPermission === '*') wantedPermission = '* *';
    let wPerms = wantedPermission.split(' ');
    let wAction = wPerms[0];
    let wResource = wPerms[1];

    let gA = [];
    let gR = [];
    givenPermissions.forEach((p) => {
      gA.push(JSON.parse(p.action));
      gR.push(p.resource);
    });

    for (var i = 0; i <= gR.length; i++) {
      if (
        (gR[i] === allSymbol &&
          (gA[i].includes('*') || gA[i].includes(wAction))) ||
        (gR[i] === wResource &&
          (gA[i].includes('*') || gA[i].includes(wAction)))
      )
        return true;
    }

    return false;
  };
};

/**
  @private
  */

function firstTrue(promises) {
  const newPromises = promises.map((p) => {
    return new Promise((resolve, reject) =>
      p.then((v) => v && resolve(true), reject)
    );
  });
  newPromises.push(Promise.all(promises).then(() => false));
  return Promise.race(newPromises);
}
