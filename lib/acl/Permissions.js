var _ = require('lodash');
var { Op } = require('sequelize');

module.exports = (SequelizeAcl) => {
  SequelizeAcl.prototype.onPermsCreated = function (fn) {
    return this.on('onPermsCreated', fn);
  };

  /**
   * Create Permissions
   *
   * @example
   * // create permissions to view blog
   * acl.createPermissions('blog','view')
   *
   * // create permissions to view blog
   * acl.createPermissions('blog','view')
   *
   *
   * @param {string} resources - The name of resource
   * @param {array|string} actions - The name(s) of actions
   * @param {object} options - options
   * @param {string} options.name - name for permission
   *
   */
  SequelizeAcl.prototype.createPermissions = function (
    resources,
    actions,
    options = {}
  ) {
    let _acts = [],
      _res = [];
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

    return insertPermissionsToDb(this, permissions, options);
  };

  /**
   * Create Permissions in bulk
   *
   * @example
   * // create permissions to view blog
   * acl.createPermissionsBulk([
   *      {resource : "blog", action: ["view","edit"], name: "blog_view_edit"]},
   *      {resource : "post", action: ["view"]},
   *      {resource : "image", action: "view"},
   * ])
   *
   *
   * @param {array} permissions - Array of permissions
   * @param {object} options - options
   *
   */
  SequelizeAcl.prototype.createPermissionsBulk = function (
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

  function insertPermissionsToDb(acl, permissions, options) {
    return acl._models.AclPermission.findAll({
      where: { name: permissions.map((d) => d.name) },
    }).then((existPerms) => {
      let perms2insert = _.differenceBy(permissions, existPerms, (r) => r.name);

      return acl._models.AclPermission.bulkCreate(perms2insert, {
      }).then((perms) => {
        acl._ee.emit('onPermsCreated', perms);

        if (options.all) {
          perms = _.concat(existPerms, perms);
        }
        if (options.json) {
          return perms.map((perm) => {
            return perm.toJSON();
          });
        }

        return perms;
      });
    });
  }

  /**
   *
   * @name findPermissions
   *
   *
   * @param  {} args
   * @param  {string} args.name
   * @param  {string} args.resource
   * @param  {string} args.action
   * @param  {bool} args.search
   */
  SequelizeAcl.prototype.findPermissions = async function (args = {}) {
    let acl = this;
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
    let perms = await acl.models().AclPermission.findAll(cond);

    return perms;
  };
};
