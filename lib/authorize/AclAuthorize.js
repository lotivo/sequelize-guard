var _ = require('lodash');

module.exports = (SequelizeAcl) => {
  // Authorize.prototype.isGuest = function(){
  //   return !!this._user;
  // }

  SequelizeAcl.prototype.getUserRoles = async function (user) {
    let _acl = this;

    const cacheKey = `roleuser_${user[_acl._options.userPk]}`;
    let roles = await _acl.getCache().then((cache) => cache.get(cacheKey));

    if (!roles) {
      roles = await user.getRoles();

      _acl
        .getCache()
        .then((cache) =>
          cache.set(cacheKey, roles, _acl._options.userCacheTtl)
        );
    }

    return roles;
  };

  /**
   *
   * @name can
   *
   * @param {string} user - action resource separated by space, eg. 'read blog'
   * @param {string} permission - action resource separated by space, eg. 'read blog'
   */
  SequelizeAcl.prototype.can = async function (user, permissionAsked) {
    let _acl = this;

    let roles = await _acl.getUserRoles(user);

    return firstTrue(
      roles.map((role) => {
        return _acl
          .getCache()
          .then((cache) => {
            return cache.getRolesWithPerms(_acl);
          })
          .then((roles) => {
            return roles[role.id].Permissions;
          })
          .then((permissions) =>
            this.resolvePermission(permissions, permissionAsked)
          );
      })
    );
  };

  function firstTrue(promises) {
    const newPromises = promises.map((p) => {
      return new Promise((resolve, reject) =>
        p.then((v) => v && resolve(true), reject)
      );
    });
    newPromises.push(Promise.all(promises).then(() => false));
    return Promise.race(newPromises);
  }

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
