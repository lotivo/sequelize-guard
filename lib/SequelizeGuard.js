var _ = require('lodash');
var EventEmitter = require('events');
var Sequelize = require('sequelize');
var migration = require('./migrations/guard-migrations');
var seeder = require('./seeder');
var defaultOpts = require('./defaultOptions');
var guardModels = require('./models/GuardModels');

var GuardControl = require('./guard/GuardControl');
var guardExtUserCache = require('./utils/userCache');
var guardExtCache = require('./utils/cache');
var guardExtRoles = require('./guard/Roles');
var guardExtPermissions = require('./guard/Permissions');
var guardExtUsers = require('./guard/Users');
var guardUserAssociations = require('./guard/GuardUserAssociations');

var authorizePerms = require('./authorize/authorizePerms');
var authorizeRoles = require('./authorize/authorizeRoles');

const _exts = [
  GuardControl,
  guardExtCache,
  guardExtUserCache,
  guardExtPermissions,
  guardExtRoles,
  guardExtUsers,
  authorizePerms,
  authorizeRoles,
];

module.exports = (function () {
  /**
   * creates a SequelizeGuard instance with all authorization.
   * @class SequelizeGuard
    @constructor
   *
   *
   * @param {Sequelize} seql - A Sequelize instance
   * @param {Object} options - custom config object
   * @param {string} [options.prefix='guard_']  - prefix for guard tables in database
   * @param {string} [options.primaryKey='id']  - primary key for guard tables
   * @param {bool} [options.timestamps=false]  - add timestamps to tables
   * @param {bool} [options.paranoid=false]  - soft deletes of items
   * @param {bool} [options.sync=true]  - auto create tables, set this to false if your are using migrations
   * @param {bool} [options.debug=false]  - debug mode, output logs
   * @param {Model} [options.UserModel=null]  - Model used for User, make sure you pass model and not name(string)
   * @param {string} [options.userPk='id']  - primary key used for User Model
   * @param {bool} [options.safeGuardDeletes=true]  - role or permissions can't be deleted as long as they are associated with any other data. To remove you must break all other associations (upcoming)
   * @param {bool} [options.userCache=true]  - roles of user will be cached, this will allow faster permission resolution and less database connections
   * @param {int} [options.userCacheTtl=60]  - time for which roles of user will be cached (in seconds), this number should be inversely proportional to your user traffic.
   *
   */
  function SequelizeGuard(seql, options) {
    const guard = this;

    this._sequelize = seql;
    seql.guard = this;

    var opts = _.extend({}, defaultOpts, options);
    this._options = opts;

    this._models = guardModels(this, this._options);
    seql.models.GuardModels = this._models;
    guardUserAssociations(this);

    this._ee = new EventEmitter();

    if (opts.sync === true) {
      Promise.all(
        _.map(this._models, (model) => {
          return model.sync({
            logging: guard._options.debug ? console.log : false,
          });
        })
      ).then((syncs) => {
        guard.getCache();
      });
    } else {
      guard.getCache();
    }
  }

  /**
   * Get All Guard models
   *
   * @example
   *  models = guard.models();
   *
   * @returns {Array} - array of models used in Authorization, including GuardUSer.
   *
   */
  SequelizeGuard.prototype.models = function () {
    return this._models;
  };

  /**
  @ignore
  */
  SequelizeGuard.prototype.on = function (name, fn) {
    this._ee.on(name, fn);
    return () => this._ee.off(name, fn);
  };

  /**
  @ignore
  */
  SequelizeGuard.prototype.once = function (name, fn) {
    this._ee.once(name, fn);
    return () => this._ee.off(name, fn);
  };

  _exts.forEach((ext) => ext(SequelizeGuard));

  /**
     * @memberof SequelizeGuard

   * @name migration
   * @description migration to run.
   * @example
   *
   *  var SequelizeGuard = require('sequelize-guard');
   *  module.exports = {
   *     up: (queryInterface, Sequelize) => {
   *         return SequelizeGuard.migration.up(queryInterface, Sequelize, {});
   *     },
   *     down: (queryInterface, Sequelize) => {
   *         return SequelizeGuard.migration.down(queryInterface, Sequelize, {});
   *     }
   *  };
   *
   */
  SequelizeGuard.migration = migration;

  /**
     * @memberof SequelizeGuard

  @name seeder
  @description seeder for default roles and permissions.
   */
  SequelizeGuard.seeder = seeder;

  return SequelizeGuard;
})();
