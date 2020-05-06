var _ = require('lodash');
var { Op } = require('sequelize');

module.exports = (SequelizeGuard) => {
  SequelizeGuard.prototype.onPermsCreated = function (fn) {
    return this.on('onPermsCreated', fn);
  };

  /**
   * Create Permissions
   *
   * @example
   * // create permissions to view blog
   * guard.createPerms('blog','view')
   *
   * // create permissions to view blog
   * guard.createPerms('blog','view')
   *
   *
   * @param {string} resources - The name of resource
   * @param {Array|string} actions - The name(s) of actions
   * @param {Object} options - options
   * @param {string} options.name - name for permission
   *
   */
  SequelizeGuard.prototype.createPerms = function (
    resources,
    actions,
    options = {}
  ) {
    let permissions = this._sanitizePermsInput(resources, actions, options);

    return insertPermissionsToDb(this, permissions, options);
  };

  /**
   * Create Permissions in bulk
   *
   * @example
   * // create permissions to view blog
   * guard.createPermsBulk([
   *      {resource : "blog", action: ["view","edit"], name: "blog_view_edit"]},
   *      {resource : "post", action: ["view"]},
   *      {resource : "image", action: "view"},
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

    permissions = permissions.map((p, i) => {
      _acts = [];

      if (typeof p.actions === 'string') _acts = [p.actions];
      if (Array.isArray(p.actions)) _acts = p.actions;

      return {
        name: p.name || `${p.resource}:[${_acts.toString()}]`,
        resource: p.resource,
        action: JSON.stringify(_acts),
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
   *  guard.findPerms({resource : 'blog', action : 'view'}).then((perms) =>{});
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
    let cond = { where: {} };

    if (args.search) {
      if (args.name) {
        wheres.push({ name: { [Op.substring]: args.name } });
      }
      if (args.resource) {
        wheres.push({ resource: { [Op.substring]: args.resource } });
      }
      if (args.action) {
        wheres.push({ action: { [Op.substring]: args.action } });
      }
    } else {
      if (args.name) wheres.push({ name: args.name });
      if (args.resource) wheres.push({ resource: args.resource });
      if (args.action) wheres.push({ action: args.action });
    }

    if (wheres.length >= 1) {
      cond.where = {
        [Op.or]: wheres,
      };
    }
    let perms = await guard.models().GuardPermission.findAll(cond);

    return perms;
  };

  SequelizeGuard.prototype._sanitizePermsInput = function (
    resources,
    actions,
    options = {}
  ) {
    let _acts = [];
    let _res = [];

    if (typeof resources === 'string') _res = [resources];
    if (Array.isArray(resources)) _res = resources;

    if (typeof actions === 'string') _acts = [actions];
    if (Array.isArray(actions)) _acts = actions;

    if (!options.names) options.names = [];

    let permissions = _res.map((r, i) => {
      return {
        name: options.names[i] || `${r}:[${_acts.toString()}]`,
        resource: r,
        action: JSON.stringify(_acts),
      };
    });

    return permissions;
  };
};

/**
  @private
  */
function insertPermissionsToDb(guard, permissions, options) {
  return guard._models.GuardPermission.findAll({
    where: { name: permissions.map((d) => d.name.toLowerCase()) },
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
