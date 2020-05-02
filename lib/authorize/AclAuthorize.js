var _ = require('lodash');

module.exports = (SequelizeAcl) => {
  // Authorize.prototype.isGuest = function(){
  //   return !!this._user;
  // }

  SequelizeAcl.prototype.getUserRoles = async function (user) {
    let _acl = this;

    const cacheKey = `user_${user[_acl._options.userPk]}`;

    return _acl.getUserCache().then((cache) => {
      let cacheRoles;
      if (_acl._options.userCache) {
        cacheRoles = cache.get(cacheKey);
      }
      if (cacheRoles) return cacheRoles;

      return user.getRoles().then((fetchedRoles) => {
        let jsonRoles = fetchedRoles.map((perm) => perm.toJSON());
        if (_acl._options.userCache) {
          cache.set(cacheKey, jsonRoles, _acl._options.userCacheTtl);
        }
        return jsonRoles;
      });
    });
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
