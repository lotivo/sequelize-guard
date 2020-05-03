var _ = require('lodash');
var EventEmitter = require('events');
var Sequelize = require('sequelize');
var migration = require('./migrations/acl-migrations');
var seeder = require('./seeder');
var defaultOpts = require('./defaultOptions');
var aclModels = require('./models/AclModels');

var AclControl = require('./acl/AclControl');
var aclExtUserCache = require('./utils/userCache');
var aclExtCache = require('./utils/cache');
var aclExtRoles = require('./acl/Roles');
var aclExtPermissions = require('./acl/Permissions');
var aclExtUsers = require('./acl/Users');
var aclUserAssociations = require('./acl/AclUserAssociations');

var authorizePerms = require('./authorize/authorizePerms');
var authorizeRoles = require('./authorize/authorizeRoles');

const _exts = [
  AclControl,
  aclExtCache,
  aclExtUserCache,
  aclExtPermissions,
  aclExtRoles,
  aclExtUsers,
  authorizePerms,
  authorizeRoles,
];

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

  SequelizeAcl.prototype.on = function (name, fn) {
    this._ee.on(name, fn);
    return () => this._ee.off(name, fn);
  };

  SequelizeAcl.prototype.once = function (name, fn) {
    this._ee.once(name, fn);
    return () => this._ee.off(name, fn);
  };

  _exts.forEach((ext) => ext(SequelizeAcl));

  SequelizeAcl.migration = migration;
  SequelizeAcl.seeder = seeder;

  return SequelizeAcl;
})();
