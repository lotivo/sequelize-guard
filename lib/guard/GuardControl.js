const _ = require('lodash');

/**
 @constructor
 *
 * @param {SequelizeGuard} guard -  SequelizeGuard instance
 *
 * @example
 * control = new GuardControl(guard);
 * control.allow('admin').to('view').on('blog').withPrivileges([{ field_name: 'title', field_display: 'TITLE', privilege: 'read/write' }]);
 * //this is not recommended approach use it with SequelizeGuard only.
 */
function GuardControl(guard) {
  this.guard = guard;
  this._roles = [];
  this._actions = [];
  this._privileges = [];
  this._resources = [];
}

/**
 * Specify role to allow
 * @memberof GuardControl
 * @example
 * // allow admin
 * control.allow('admin')
 * control.allow(['admin', 'content-manager'])
 *
 *
 * @param {string} role - The name of role
 */
GuardControl.prototype.allow = function (role) {
  if (typeof role !== 'string') {
    throw new Error("Role must be a string");
  }
  this._roles = role;
  return this;
};

/**
 * Specify actions for current control
 *
 * @memberof GuardControl
 *
 * @example
 * // to view
 * control.to('view')
 *
 * @param {Array|string} actions - The name(s) of actions
 */
GuardControl.prototype.to = function (actions) {
  if (typeof actions === 'string') {
    this._actions = _.uniq([...this._actions, actions]);
  }

  if (Array.isArray(actions)) {
    this._actions = _.uniq([...this._actions, ...actions]);
  }

  return this;
};

/**
 * Specify actions for current control
 *
 * @memberof GuardControl
 *
 * @example
 * // with privileges
 * control.withPrivileges([{ name: 'title', label: 'TITLE', privilege: 'read/write' }])
 * privilege must be one of (read) (read/write) (nothing)
 *
 * @param {Array<string|{
 *   name: string;
 *   label: string;
 *   privilege: 'read'|'read/write'|'nothing';
 * }>} privileges
 */
GuardControl.prototype.withPrivileges = function (privileges) {
  if (typeof privileges === 'string') {
    throw new Error("privileges must be an array!");
  }

  privileges = _.map(privileges, (privilege) => {
    if (typeof privilege === "string") {
      return {
        name: privilege, label: privilege, privilege: 'read/write'
      }
    }
  });

  if (Array.isArray(privileges)) {
    this._privileges = _.uniq([...this._privileges, ...privileges]);
  }

  return this;
};

/**
 * Specify resources for current control
 * @memberof GuardControl
 *
 * @example
 * // add blog to current control
 * control.on('blog')
 *
 * @param {Array<string>|string} resources - The name(s) of resources
 */
GuardControl.prototype.on = function (resources) {
  if (typeof resources === 'string') this._resources = _.uniq([...this._resources, resources]);

  if (Array.isArray(resources)) this._resources = _.uniq([...this._resources, ...resources]);

  return this;
};

/**
 * Commit current control
 *
 * @memberof GuardControl

 * @example
 *
 * control.commit()
 *
 *  @return {Promise} Promise resolved when finished
 */
GuardControl.prototype.commit = async function () {
  const guard = this.guard;
  const roles = this._roles;
  const actions = this._actions;
  const privileges = this._privileges;
  const resources = this._resources;

  return guard.addPermsToRole(roles, actions, privileges, resources);
};

module.exports = function (SequelizeGuard) {
  /**
   * @description start new guard statement

   *
   * @example
   * // empty previous specification
   * let control = guard.init();
   *
   */
  SequelizeGuard.prototype.init = function () {
    return new GuardControl(this);
  };

  /**
   * create guard statement in one sentence
   *

   * @example
   * guard.allow('admin','view', '*','blogs');
   * allows admin to view blog titles.
   *
   * @param {string} role - role to assign permissions to
   * @param {Array} actions - array of actions
   * @param {Array<string|{
   *   name: string;
   *   label: string;
   *   privilege: 'read'|'read/write'|'nothing';
   * }>} privileges - array of privileges
   * @param {Array} resources - array of resources
   *
   * @returns {Promise<{role, permissions}>} - roles with assigned permissions.
   */
  SequelizeGuard.prototype.allow = function (role, actions, privileges, resources) {
    return this.init().allow(role).to(actions).on(resources).withPrivileges(privileges).commit();
  };
};
