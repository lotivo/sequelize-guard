var _ = require('lodash');

module.exports = (SequelizeAcl) => {
  // Authorize.prototype.isGuest = function(){
  //   return !!this._user;
  // }

  SequelizeAcl.prototype.userHasRoles = async function (user, roles) {
    let _acl = this;

    const cacheKey = `user_${user[_acl._options.userPk]}`;

    return _acl.getUserRoles().then((userRoles) => {
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
};
