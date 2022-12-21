const _ = require('lodash');
const { Op } = require('sequelize');

module.exports = (SequelizeGuard) => {
  /**
   * Creates a new role if not already present.
   *
   *  created field is set to true if new role is created.
   *
   *
   * @example
   *
   *   guard.makeRole('admin').then(({role, created}) =>{});
   *
   * //this will return a promise  which will resolve to object { role, created }.
   *
   * @param  {string|{
   *   name: string;
   *   display_name: string;
   *   description?: string;
   *   editable?: boolean;
   * }} role - role to create, case-insensitive
   * @return {Promise<{role, created}>} - object with model instance of Role and created boolean set to true if new role created.
   */
  SequelizeGuard.prototype.makeRole = async function (role) {
    if (!role) throw new Error('Role must be string with length not zero');

    const _guard = this;

    let roleData = makeRoleData(role);

    return this.getCache()
      .then((cache) => {
        const roles = cache.get('roles');
        return _.find(roles, roleData);
      })
      .then((role) => {
        if (role) {
          return { role, created: false };
        }

        return this._models.GuardRole.findOrCreate({ where: roleData }).then(
          ([role, created]) => {
            _guard._ee.emit('onRolesCreated', [role]);
            return { role, created };
          }
        );
      });
  };

  /**
   * Create multiple roles. creates role which are not available.
   * @example
   *
   *   guard.makeRoles(['admin','mod']).then((roles) =>{});
   *
   * //this will return a promise which will resolve to give array of roles.
   *
   * @param  {Array} roles - roles to create, case-insensitive
   * @param  {Object} options
   * @param  {bool|true} options.json - when true returns roles as plain objects otherwise model instances, for newly created roles only.
   * @param  {bool|false} options.all - when true returns all roles passed as argument, by default returns only the ones which are created.
   * @return {Promise<Array>} - array of roles.
   */
  SequelizeGuard.prototype.makeRoles = function (
    roles,
    options = { json: true }
  ) {
    let _guard = this;
    roles = sanitizeRolesInput(roles);
    let roles2insert = [...roles];

    return this.getCache()
      .then((cache) => {
        let existRoles = _.values(cache.get('roles'));
        let rNames = existRoles.map((d) => d.name);
        rNames = _.remove(roles2insert, (r) => rNames.indexOf(r.name) >= 0).map(
          (d) => d.name
        );
        return _.filter(existRoles, (r) => rNames.indexOf(r.name) >= 0);
      })
      .then((existRoles) => {
        return this._models.GuardRole.bulkCreate(roles2insert).then(
          (insertedRoles) => {
            let roles = insertedRoles;
            if (insertedRoles.length) {
              _guard._ee.emit('onRolesCreated', insertedRoles);
            }
            if (options.json) {
              roles = roles.map((role) => {
                return role.toJSON();
              });
            }
            if (options.all) {
              roles = _.concat(existRoles, roles);
            }
            return roles;
          }
        );
      });
  };

  /**
   * Delete multiple roles.
   * @example
   *
   *   guard.deleteRoles(['admin','mod']).then((deletedCount) =>{});
   *
   *  // deletes all the roles specified and are present and returns number of roles deleted.
   *
   * @param  {Array} roles - roles to delete, case-insensitive
   * @return {Promise<int>} - number of roles deleted.
   */
  SequelizeGuard.prototype.deleteRoles = function (roles) {
    let _guard = this;

    roles = sanitizeRolesInput(roles);

    return this.getCache()
      .then((cache) => {
        let cacheRoles = cache.get('roles');
        let roleNames = roles.map((d) => d.name);
        return _.filter(cacheRoles, function (role) {
          return roleNames.indexOf(role.name) >= 0;
        });
      })
      .then((roles) => {
        if (!roles.length) return 0;
        return this._models.GuardRole.destroy({
          where: { name: roles.map((d) => d.name) },
        }).then((r) => {
          _guard._ee.emit('onRolesDeleted', roles);
          return r;
        });
      });
  };

  /**
   * Get All Available Roles.
   * @example
   *
   *  guard.allRoles().then((roles) =>{});
   *
   *  // roles will be array of role objects.
   *
   * @return {Promise<Array>} - array of roles as plain object
   */
  SequelizeGuard.prototype.allRoles = function () {
    return this.getCache().then((cache) => _.values(cache.get('roles')));
  };

  /**
   * Get Role by name.
   * @example
   *
   *  guard.allRoles().then((roles) =>{});
   *
   *  // roles will be array of role objects.
   *
   * @return {Promise<Array>} - array of roles as plain object
   */
  SequelizeGuard.prototype.getRole = function (role) {
    return this.getCache()
      .then((cache) =>
        _.values(cache.get('roles')).filter(
          (r) => r.name === role.toLowerCase()
        )
      )
      .then((roles) => (roles.length ? roles[0] : null));
  };

  /**
   * Find Roles. returns all roles if no arg passed.
   * @example
   *
   *  guard.findRoles().then((roles) =>{});
   *
   *  guard.findRoles({name : 'admin'}).then((roles) =>{});
   *
   *  guard.findRoles({names : ['admin', 'mod']}).then((roles) =>{});
   *
   *  guard.findRoles({names : ['admin', 'mod'], search : true}).then((roles) =>{});
   *
   *  // roles will be array of role objects.
   * @param  {Object} args - search object
   * @param  {name} args.name - name of role to find
   * @param  {Array} args.names - names of roles to find
   * @param  {bool} args.search - if set to true will perform match on the name(S), otherwise exact match.
   *
   * @return {Promise<Array>} - array of roles as model instances
   */
  SequelizeGuard.prototype.findRoles = async function (args = {}) {
    let _guard = this;
    let wheres = [];
    let cond = { where: {} };

    if (args.names && args.names.length) {
      if (args.search) {
        args.names.forEach((name) => {
          wheres.push({ name: { [Op.substring]: name } });
        });
      } else {
        args.names.forEach((name) => {
          wheres.push({ [Op.or]: { name: name } });
        });
      }
    } else if (args.name) {
      wheres.push({ name: args.name });
    }

    if (wheres.length > 0) {
      cond.where = {
        [Op.or]: wheres,
      };
    }

    if (args.withParent) {
      cond.include = 'Parent';
    }

    let roles = await _guard.models().GuardRole.findAll(cond);

    return roles;
  };

  /**
    * add permissions to role
    *
   * @example
   * guard.addPermsToRole('admin','view', 'title', 'blogs');
   * //allows admin to view blog.

   * guard.addPermsToRole('admin',['view'], ['title'],['blogs']);
   * //pass resources, actions and privileges as arrays
   *
   * @param {string} role - role to assign permissions to
   * @param {Array} actions - array of actions
   * @param {Array} privileges - array of privileges
   * @param {Array} resources - array of resources
   *
   * @returns {Promise<{role, permissions}>} - roles with assigned permissions.
   */
  SequelizeGuard.prototype.addPermsToRole = async function (
    role,
    actions,
    privileges,
    resources
  ) {
    let guard = this;
    // const names = resources.ma
    return guard
      .createPerms(resources, actions, privileges, { all: true })
      .then((perms) => {
        return guard
          .makeRole(role)
          .then(({ role }) => {
            if (role.dataValues) return [role];
            return guard.findRoles({ name: role.name });
          })
          .then((roles) => roles[0])
          .then((role) => {
            return role.getPermissions().then((assignedPerms) => {
              let perms2add = _.differenceBy(
                perms,
                assignedPerms,
                (r) => r.name
              );

              return role.addPermissions(perms2add).then((rolePermModel) => {
                role.Permissions = [...assignedPerms, ...perms2add];
                role.dataValues.Permissions = role.Permissions;
                guard._ee.emit('onPermsAddedToRole', role);
                return {
                  role,
                  permissions: role.Permissions,
                };
              });
            });
          });
      });
  };

  /**
   * remove permissions from role
   *
   * @example
   * guard.rmPermsFromRole('admin','view', 'title', 'blogs');
   * //remove permission from admin to view blog.

   * guard.rmPermsFromRole('admin',['view'], ['title'], ['blogs']);
   * //pass resources, actions and fields as arrays
   *
   * @param {string} role - role to assign permissions to
   * @param {Array} actions - array of actions
   * @param {Array} resources - array of resources
   *
   * @returns {Promise<{role, permissions, permsRemoved}>} - role with remaining permissions, remaining permissions and permsRemoved
   */
  SequelizeGuard.prototype.rmPermsFromRole = async function (
    role,
    actions,
    resources
  ) {
    let guard = this;

    let perms2rmIn = guard._sanitizePermsInput(resources, actions);

    return guard
      .makeRole(role)
      .then(({ role }) => {
        if (role.dataValues) return [role];
        return guard.findRoles({ name: role.name });
      })
      .then((roles) => roles[0])
      .then((role) => {
        return role.getPermissions().then((assignedPerms) => {
          let perms2rm = _.intersectionBy(
            assignedPerms,
            perms2rmIn,
            (r) => r.resource + r.actions
          );

          return role.removePermissions(perms2rm).then((rolePermModel) => {
            role.Permissions = _.without(assignedPerms, ...perms2rm);
            role.dataValues.Permissions = role.Permissions;
            guard._ee.emit('onPermsRemovedFromRole', role);

            return {
              role,
              permissions: role.Permissions,
              permsRemoved: perms2rm,
            };
          });
        });
      });
  };

  /**
   * Subscribe to Listen to onRolesCreated Event. created roles are passed to given function.
   * @example
   *
   *  let unsubscribe = guard.onRolesCreated(function(roles){
   *      // roles which were created.
   *  });
   *
   * @param {function} cb - function to be called when new role(s) is/are created.
   * @return {function} function to unsubscribe from event.
   */
  SequelizeGuard.prototype.onRolesCreated = function (cb) {
    return this.on('onRolesCreated', cb);
  };

  /**
   * Subscribe to Listen to onRolesDeleted Event. Deleted roles are passed to given function.
   * @example
   *
   *  let unsubscribe = guard.onRolesDeleted(function(roles){
   *      // roles which were Deleted.
   *  });
   *
   *@param {function} cb - function to be called when role(s) is/are Deleted.
   * @return {function} - function to unsubscribe from event.
   */
  SequelizeGuard.prototype.onRolesDeleted = function (cb) {
    return this.on('onRolesDeleted', cb);
  };

  /**
   * Subscribe to Listen to onPermsAddedToRole Event. role with permissions is passed to given function.
   * @example
   *
   *  let unsubscribe = guard.onPermsAddedToRole(function(role){
   *      // role with permissions.
   *  });
   *
   *@param {function} cb - function to be called when role(s) are assigned permissions.
   * @return {function} - function to unsubscribe from event.
   */

  SequelizeGuard.prototype.onPermsAddedToRole = function (cb) {
    return this.on('onPermsAddedToRole', cb);
  };

  /**
   * Subscribe to Listen to onPermsRemovedFromRole Event. role with permissions is passed to given function.
   * @example
   *
   *  let unsubscribe = guard.onPermsRemovedFromRole(function(role){
   *      // role with permissions after removal
   *  });
   *
   *@param {function} cb - function to be called when role(s) are assigned permissions.
   * @return {function} - function to unsubscribe from event.
   */

  SequelizeGuard.prototype.onPermsRemovedFromRole = function (cb) {
    return this.on('onPermsRemovedFromRole', cb);
  };
};

/**
 * @private
 */
function makeRoleData(role) {
  let roleData = {};
  if (typeof role === 'string') {
    roleData = { name: role.toLowerCase(), display_name: role };
  } else if (typeof role === 'object') {
    roleData = role;
    roleData.name = roleData.name.toLowerCase();
  } else {
    return {};
  }
  return roleData;
}

/**
 * @private
 */
function sanitizeRolesInput(roles) {
  if (typeof roles === 'string') {
    roles = [roles];
  }
  return roles
    .map((role) => makeRoleData(role))
    .filter((role) => {
      return typeof role.name === 'string' && role.name.length > 0;
    });
}
