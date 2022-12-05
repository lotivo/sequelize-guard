var _ = require('lodash');

module.exports = (SequelizeGuard) => {

  /**
    * @private
    * @name permitedFields
    * @description Return user permitted fields on specific resource
    * @param {any} user
    * @param {string} resource
  */ 

  SequelizeGuard.prototype.permittedResourceFields = async function (user, resource) {
    const _guard = this;

    const roles = await _guard.getUserRoles(user);
    let fields = [];

      await Promise.all(roles.map((role) =>
      _guard
        .getCache()
        .then((cache) => cache.getRolesWithPerms(_guard))
        .then((roles) => roles[role.id].Permissions)
        .then((perms) => perms.find((perm) => perm.resource === resource))
        .then((perm) => {
          if(perm) {
            const parsedFields = JSON.parse(perm.fields);
            parsedFields.forEach((field) => {
              if(!fields.includes(field)) {
                fields.push(field);
              }
            })
          }
        })
    ));

      return fields;
  }

  /**
  * @private
   * @name can
   * @description Return true if user don't have the permission

   * @param {string} user - action resource separated by space, eg. 'read blog'
   * @param {string} permission - action resource separated by space, eg. 'read blog'
   */
  SequelizeGuard.prototype.userCant = async function (user, permission) {
    return this.userCan(user, permission).then((result) => !result);
  };

  /**
    @private

   * @name can
   *
   * @param {string} user - action resource separated by space, eg. 'read blog'
   * @param {string} permission - action resource separated by space, eg. 'read blog'
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

  /**
  @private
  */

  SequelizeGuard.prototype.resolvePermission = function (
    givenPermissions,
    wantedPermission
  ) {
    const allSymbol = '*';
    if (wantedPermission === '*') wantedPermission = '* *';
    const wPerms = wantedPermission.split(' ');
    const wAction = wPerms[0];
    const wResource = wPerms[1];
    const wField = wPerms[2] || null;

    const gA = [];
    const gR = [];
    const gF = [];

    givenPermissions.forEach((p) => {
      gA.push(JSON.parse(p.action));
      gF.push(JSON.parse(p.fields));
      gR.push(p.resource);
    });

    if(wField) {
      // if user pass field value
      for(let i=0; i < gR.length; i++) {
        if (
          ([allSymbol, wResource].includes(gR[i])) &&
            (gA[i].includes('*') || gA[i].includes(wAction)) &&
            (gF[i].includes('*') || gF[i].includes(wField))
        ) {
          return true;
        }
      }
      return false;
    }

    for (var i = 0; i <= gR.length; i++) {
      if (
        ([allSymbol, wResource].includes(gR[i])) &&
          (gA[i].includes('*') || gA[i].includes(wAction))
      ) {
        return true;
      }
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
