var _ = require('lodash');
var Sequelize = require('sequelize');
const Op = Sequelize.Op;

module.exports = (SequelizeGuard) => {
  /**
   * Make User
   *
   * @example
   * // make a user
   * guard.makePermission('blog','view')
   *
   *
   * @param {Array|string} user - The name(s) of role
   */
  SequelizeGuard.prototype.makeUser = function (user) {
    // if(!this._models.GuardUser){
    //     throw new Error("Use this function when UserModel is passed in options");
    // }

    return this._models.GuardUser.create({
      name: user.name,
      email: user.email,
    });
  };

  /**
  * Assign role to user

   * @param  {Object} user - the user you want to give role
   * @param  {string} role - the role to give to user
   */
  SequelizeGuard.prototype.assignRole = function (user, role) {
    return this.makeRole(role).then(({ role, created }) => {
      return user.addRole(role.id).then((d) => {
        return user;
      });
    });
  };

  /**
  * Assign roles to user

   * @param  {Object} user - the user you want to give role
   * @param  {Array} roles - the roles to give to user
   */
  SequelizeGuard.prototype.assignRoles = function (user, roles) {
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

  /**
  * Remove roles from association with user user

   * @param  {Object} user - the user you want to give role
   * @param  {string} roles - the roles to give to user
   */
  SequelizeGuard.prototype.rmAssignedRoles = function (user, roles) {
    if (typeof roles === 'string') roles = [roles];

    return this._models.GuardRole.findAll({
      where: { name: { [Op.in]: roles } },
    }).then((roles) => {
      return user.removeRoles(roles);
    });
  };

  SequelizeGuard.prototype.getUserRoles = async function (user) {
    let _guard = this;

    const cacheKey = `user_${user[_guard._options.userPk]}`;

    return _guard.getUserCache().then((cache) => {
      let cacheRoles;
      if (_guard._options.userCache) {
        cacheRoles = cache.get(cacheKey);
      }
      if (cacheRoles) return cacheRoles;

      return user.getRoles().then((fetchedRoles) => {
        let jsonRoles = fetchedRoles.map((perm) => perm.toJSON());
        if (_guard._options.userCache) {
          cache.set(cacheKey, jsonRoles, _guard._options.userCacheTtl);
        }
        return jsonRoles;
      });
    });
  };
};
