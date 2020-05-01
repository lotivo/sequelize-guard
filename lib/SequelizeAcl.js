var _ = require('lodash');
var EventEmitter = require('events');
var Sequelize = require('sequelize');
var migration = require('./migrations/acl-migrations');
var seeder = require('./seeder');
var defaultOpts = require('./defaultOptions');
var aclModels = require('./models/AclModels');

var aclExtCache = require('./utils/cache');
var aclExtRoles = require('./acl/Roles');
var aclExtPermissions = require('./acl/Permissions');
var aclExtUsers = require('./acl/Users');
var aclUserAssociations = require('./acl/AclUserAssociations');

var aclAuthorize = require('./authorize/AclAuthorize');
var AclControl = require('./acl/AclControl');

module.exports = (function () {
  function SequelizeAcl(seql, options) {
    const acl = this;

    this._sequelize = seql;
    seql.acl = this;

    var opts = _.extend({}, defaultOpts, options);
    this._options = opts;

    this._models = aclModels(this, this._options);
    seql.models.AclModels = this._models;
    aclUserAssociations(this);

    this._ee = new EventEmitter();

    if (opts.sync === true) {
      Promise.all(
        _.map(this._models, (model) => {
          return model.sync({
            logging: acl._options.debug ? console.log : false,
          });
        })
      ).then((syncs) => {
        acl.getCache();
      });
    } else {
      acl.getCache();
    }
  }

  /**
   * Get All Acl models
   *
   */
  SequelizeAcl.prototype.models = function () {
    return this._models;
  };

  /**
   * start new control statement
   *
   * @example
   * // empty previous specification
   * acl.start()
   *
   */
  SequelizeAcl.prototype.init = function () {
    return new AclControl(this);
  };

  SequelizeAcl.prototype.allow = function (role, actions, resources) {
    return this.init().allow(role).to(actions).on(resources).commit();
  };

  SequelizeAcl.prototype.on = function (name, fn) {
    this._ee.on(name, fn);
    return () => this._ee.off(name, fn);
  };

  SequelizeAcl.prototype.once = function (name, fn) {
    this._ee.once(name, fn);
    return () => this._ee.off(name, fn);
  };

  aclExtCache(SequelizeAcl);
  aclExtPermissions(SequelizeAcl);
  aclExtRoles(SequelizeAcl);
  aclExtUsers(SequelizeAcl);
  aclAuthorize(SequelizeAcl);

  SequelizeAcl.migration = migration;
  SequelizeAcl.seeder = seeder;

  return SequelizeAcl;
})();
