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
  /**
   * creates a SequelizeAcl instance with all authorization.
   * @class SequelizeAcl
    @constructor
   *
   *
   * @param {Sequelize} seql - A Sequelize instance
   * @param {Object} options - custom config object
   * @param {string} [options.prefix='acl_']  - prefix for acl tables in database
   * @param {string} [options.primaryKey='id']  - primary key for acl tables
   * @param {bool} [options.timestamps=false]  - add timestamps to tables
   * @param {bool} [options.paranoid=false]  - soft deletes of items
   * @param {bool} [options.sync=true]  - auto create tables, set this to false if your are using migrations
   * @param {bool} [options.debug=false]  - debug mode, output logs
   * @param {Model} [options.UserModel=null]  - Model used for User, make sure you pass model and not name(string)
   * @param {string} [options.userPk='id']  - primary key used for User Model
   * @param {bool} [options.safeAclDeletes=true]  - role or permissions can't be deleted as long as they are associated with any other data. To remove you must break all other associations (upcoming)
   * @param {bool} [options.userCache=true]  - roles of user will be cached, this will allow faster permission resolution and less database connections
   * @param {int} [options.userCacheTtl=60]  - time for which roles of user will be cached (in seconds), this number should be inversely proportional to your user traffic.
   *
   */
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
   * @example
   *  models = acl.models();
   *
   * @returns {Array} - array of models used in Authorization, including AclUSer.
   *
   */
  SequelizeAcl.prototype.models = function () {
    return this._models;
  };

  /**
  @ignore
  */
  SequelizeAcl.prototype.on = function (name, fn) {
    this._ee.on(name, fn);
    return () => this._ee.off(name, fn);
  };

  /**
  @ignore
  */
  SequelizeAcl.prototype.once = function (name, fn) {
    this._ee.once(name, fn);
    return () => this._ee.off(name, fn);
  };

  _exts.forEach((ext) => ext(SequelizeAcl));

  /**
     * @memberof SequelizeAcl

   * @name migration
   * @description migration to run.
   * @example
   *
   *  var SequelizeAcl = require('@lotivo/sequelize-acl');
   *  module.exports = {
   *     up: (queryInterface, Sequelize) => {
   *         return SequelizeAcl.migration.up(queryInterface, Sequelize, {});
   *     },
   *     down: (queryInterface, Sequelize) => {
   *         return SequelizeAcl.migration.down(queryInterface, Sequelize, {});
   *     }
   *  };
   *
   */
  SequelizeAcl.migration = migration;

  /**
     * @memberof SequelizeAcl

  @name seeder
  @description seeder for default roles and permissions.
   */
  SequelizeAcl.seeder = seeder;

  return SequelizeAcl;
})();
