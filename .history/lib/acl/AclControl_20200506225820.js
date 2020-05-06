var _ = require('lodash');

/**
@constructor
 *
 * @param {SequelizeGuard} guard -  SequelizeGuard instance
 *
 * @example
 * control = new GuardControl(guard);
 * control.allow('admin').to('view').on('blog');
 * //this is not recommended approach use it with SequelizeGuard only.
 */
function GuardControl(guard) {
  this.guard = guard;
  this._roles = [];
  this._actions = [];

  this._resources = [];
}

/**
 * Specify role to allow
 * @memberof GuardControl
 * @example
 * // allow admin
 * control.allow('admin')
 *
 *
 * @param {string} roles - The name of role
 */
GuardControl.prototype.allow = function (roles) {
  if (typeof roles === 'string') this._roles = roles;
  // if(typeof roles === 'string') this._control._roles = _.uniq([...this._control._roles, roles ])
  // if(Array.isArray(roles)) {
  //     this._control._roles = _.uniq([...this._control._roles, ...roles ])
  // }
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
 * Specify resources for current control
 * @memberof GuardControl
 *
 * @example
 * // add blog to current control
 * control.on('blog')
 *
 * @param {Array|string} resources - The name(s) of resources
 */
GuardControl.prototype.on = function (resources) {
  if (typeof resources === 'string')
    this._resources = _.uniq([...this._resources, resources]);

  if (Array.isArray(resources))
    this._resources = _.uniq([...this._resources, ...resources]);

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
  let guard = this.guard;
  let roles = this._roles;
  let actions = this._actions;
  let resources = this._resources;

  return guard.addPermsToRole(roles, actions, resources);
};

module.exports = function (SequelizeGuard) {
  /**
  * @description start new guard statement

   *
   * @example
   * // empty previous specification
   * let guard = guard.guard();
   *
   */
  SequelizeGuard.prototype.guard = function () {
    return new GuardControl(this);
  };

  /**
   * create guard statement in one sentence
   *

   * @example
   * guard.allow('admin','view','blogs');
   * allows admin to view blog.
   *
   * @param {string} role - role to assign permissions to
   * @param {Array} actions - array of actions
   * @param {Array} resources - array of resources
   *
   * @returns {Promise<{role, permissions}>} - roles with assigned permissions.
   */
  SequelizeGuard.prototype.allow = function (role, actions, resources) {
    return this.init().allow(role).to(actions).on(resources).commit();
  };
};
