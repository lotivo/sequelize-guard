var _ = require('lodash');
var Sequelize = require('sequelize');
const Op = Sequelize.Op;

module.exports = (SequelizeAcl) => {
  /**
   * Make User
   *
   * @example
   * // make a user
   * acl.makePermission('blog','view')
   *
   *
   * @param {array|string} user - The name(s) of role
   * @param {array|string} roles - The name(s) of role
   */
  SequelizeAcl.prototype.makeUser = function (user, options = {}) {
    // if(!this._models.AclUser){
    //     throw new Error("Use this function when UserModel is passed in options");
    // }

    return this._models.AclUser.create({
      name: user.name,
      email: user.email,
    });
  };

  SequelizeAcl.prototype.assignRole = function (user, role) {
    return this.makeRole(role).then(({ role, created }) => {
      return user.addRole(role.id).then((d) => {
        return user;
      });
    });
  };

  SequelizeAcl.prototype.assignRoles = function (user, roles) {
    return this.makeRoles(roles, { all: true })
      .then((allRoles) => {
        return user.getRoles().then((assignedRoles) => {
          return _.differenceBy(allRoles, assignedRoles, (r) => r.name);
        });
      })
      .then((roles2insert) => {
        return user.addRoles(roles2insert.map((r) => r.id));
      });
  };

  SequelizeAcl.prototype.rmAssignedRoles = function (user, roles) {
    if (typeof roles === 'string') roles = [roles];

    return this._models.AclRole.findAll({
      where: { name: { [Op.in]: roles } },
    }).then((roles) => {
      return user.removeRoles(roles);
    });
  };

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
};
