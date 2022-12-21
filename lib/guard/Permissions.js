const _ = require('lodash');
const {Op} = require('sequelize');

module.exports = (SequelizeGuard) => {
  SequelizeGuard.prototype.onPermsCreated = function (fn) {
    return this.on('onPermsCreated', fn);
  };

  /**
   * Create Permissions
   *
   * @example
   * // create permissions to view blog
   * guard.createPerms('blog','view', 'title')
   *
   * // create permissions to view blog
   * guard.createPerms('blog','view', 'title')
   *
   *
   * @param {string} resources - The name of resources
   * @param {Array|string} actions - The name(s) of actions
   * @param {Array<string|{
   *   name: string;
   *   label: string;
   *   privilege: 'read'|'read/write'|'nothing';
   * }>} privileges - Privileges
   * @param {Object} options - options
   * @param {string[]} options.names - name for permission
   * @param {string[]} options.descriptions - description for permission
   *
   */
  SequelizeGuard.prototype.createPerms = function (
    resources,
    actions,
    privileges,
    options = {}
  ) {
    const permissions = this._sanitizePermsInput(resources, actions, privileges, options);

    return insertPermissionsToDb(this, permissions, options);
  };

  /**
   * Create Permissions in bulk
   *
   * @example
   * // create permissions to view blog
   * guard.createPermsBulk([
   *      {resource : "blog", actions: ["view","edit"], privileges: ["title", "category"], name: "blog_view_edit"},
   *      {resource : "post", actions: ["view"], privileges: ["title"]},
   *      {resource : "image", actions: "view", privileges: "alt"},
   * ])
   *
   *
   * @param {Array} permissions - Array of permissions
   * @param {Object} options - options
   *
   */
  SequelizeGuard.prototype.createPermsBulk = function (
    permissions,
    options = {}
  ) {
    let _acts = [];
    let _privileges = [];

    permissions = permissions.map((p, i) => {
      _acts = [];

      if (typeof p.actions === 'string') _acts = [p.actions];
      if (Array.isArray(p.actions)) _acts = p.actions;

      if (typeof p.privileges === 'string') _privileges = [p.privilege];
      if (Array.isArray(p.privileges)) _privileges = p.privilege;

      return {
        name: (p.name || `${p.resource}:[${_acts.toString()}]`).toLowerCase(),
        resource: p.resource,
        actions: _acts,
        privilege: _privileges
      };
    });

    return insertPermissionsToDb(this, permissions, options);
  };

  /**
   * Find Permissions. returns all permissions if no arg passed.
   * @example
   *
   *  guard.findPerms().then((perms) =>{});
   *
   *  guard.findPerms({name : 'admin'}).then((perms) =>{});
   *
   *  guard.findPerms({resource : 'blog', action : 'view', privileges: []}).then((perms) =>{});
   *
   *  guard.findPerms({action : 'view', search : true}).then((perms) =>{});
   *
   *  // perms will be array of permissions model objects.
   * @param  {Object} args - search object
   * @param  {name} args.name - name of permissions to find
   * @param  {string} args.resource - name of resource eg. blog, post
   * @param  {string} args.action - nae of action eg. view, edit
   * @param  {bool} args.search - if set to true will perform match on the name, resource and action, otherwise exact match.
   *
   * @return {Promise<Array>} - array of permissions as model instances
   */
  SequelizeGuard.prototype.findPerms = async function (args = {}) {
    let guard = this;
    let wheres = [];
    let cond = {where: {}};

    if (args.search) {
      if (args.name) {
        wheres.push({name: {[Op.substring]: args.name}});
      }
      if (args.resource) {
        wheres.push({resource: {[Op.substring]: args.resource}});
      }
      if (args.action) {
        wheres.push({actions: {[Op.substring]: args.action}});
      }
    } else {
      if (args.name) wheres.push({name: args.name});
      if (args.resource) wheres.push({resource: args.resource});
      if (args.action) wheres.push({actions: args.action});
    }

    if (wheres.length >= 1) {
      cond.where = {
        [Op.or]: wheres,
      };
    }
    const perms = await guard.models().GuardPermission.findAll(cond);

    return perms;
  };

  /**
   * Create Permissions
   *
   * @example
   * // update permission
   * guard.updatePerms([{
   *  name: 'edit_blog',
   *  resource: 'blog',
   *  actions: ['create', 'update', 'index'],
   *  privileges: [],
   * }])
   *
   * @param {Array} permissions - permissions
   *
   */
  SequelizeGuard.prototype.updatePerms = function (
    permissions
  ) {
    return updatePermissionsInDb(this, permissions);
  };

  // sanitization
  SequelizeGuard.prototype._sanitizePermsInput = function (
    resources,
    actions,
    privileges,
    options = {}
  ) {
    let _actions = [];
    let _privileges = [];
    let _resources = [];

    if (typeof resources === 'string') _resources = [resources];
    if (Array.isArray(resources)) _resources = resources;

    if (typeof actions === 'string') _actions = [actions];
    if (Array.isArray(actions)) _actions = actions;

    if (typeof privileges === 'string') _privileges = [privileges];
    if (Array.isArray(privileges)) _privileges = privileges;

    if (!options.names) options.names = [];

    const permissions = _resources.map((resource, i) => ({
      name: (options.names[i] || `${resource}:[${_actions.toString()}]`).toLowerCase(),
      resource,
      actions: _actions,
      privileges: _privileges,
    }));

    return permissions;
  };
};

/**
 @private
 */
function insertPermissionsToDb(guard, permissions, options) {
  return guard._models.GuardPermission.findAll({
    where: {name: permissions.map((d) => d.name.toLowerCase())},
  }).then((existPerms) => {
    let perms2insert = _.differenceBy(permissions, existPerms, (r) => r.name);

    return guard._models.GuardPermission.bulkCreate(perms2insert, {}).then(
      (perms) => {
        guard._ee.emit('onPermsCreated', perms);

        if (options.all) {
          perms = _.concat(existPerms, perms);
        }
        if (options.json) {
          return perms.map((perm) => {
            return perm.toJSON();
          });
        }

        return perms;
      }
    );
  });
}

/**
 @private
 */
function updatePermissionsInDb(guard, permissions) {
  return guard._models.GuardPermission.findAll({
    where: {
      name: {
        [Op.in]: permissions.map((p) => p.name)
      }
    },
  }).then((perms) => {
    return Promise.all(perms.map((permission, index) => {
      if (!permission) return Promise.resolve();
      const data = {...permissions[index]};
      const pre_name = (`${permission.resource}:${permission.actions.toString()}`).toLowerCase();
      if (permission.name === pre_name) {
        data.name = (`${permissions[index].resource}:${permissions[index].actions.toString()}`).toLowerCase();
      }
      return permission.update(data);
    }));
  });

}
