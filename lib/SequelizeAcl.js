var _ = require('lodash');
var Sequelize = require('sequelize');
var migration = require('./migrations/acl-migrations');
var seeder = require('./seeder');
var defaultOpts = require('./defaultOptions');
var aclModels = require("./models/AclModels");
var aclAssociations = require("./models/AclAssociations");

var aclExtRoles = require('./acl/Roles');
var aclExtPermissions = require('./acl/Permissions');
var aclExtUsers = require('./acl/Users');

module.exports = (function(){

    function SequelizeAcl(seql, options) {

        this._sequelize = seql;
        seql.acl = this;

        var opts = _.extend(defaultOpts, options);
        this._options = opts;

        this._models = aclModels(seql, this._options);
        aclAssociations(this);

        if (opts.sync === true) {
            _.each(this._models, function(model, name) {
                model.sync({
                    logging: this.debug ? console.log : false
                });
            }.bind(this));
        }

        this._roles = [];
        this._actions = [];
        this._resources = [];

    }

    /**
     * start new control statement
    *
    * @example
    * // empty previous specification
    * acl.start()
    *
    */
    SequelizeAcl.prototype.make = function(){
        this._roles = [];
        this._actions = [];
        this._resources = [];
        return this;
    }

    /**
     * Specify roles to allow
    *
    * @example
    * // allow admin
    * acl.allow('admin')
    *
    *
    * @param {array|string} roles - The name(s) of role
    */
    SequelizeAcl.prototype.allow = function(roles){
        if(typeof roles === 'string') this._roles = _.uniq([...this._roles, roles ])
        if(Array.isArray(roles)) {
            this._roles = _.uniq([...this._roles, ...roles ])
        }
        return this;
    }

    /**
     * Specify actions for current control
    *
    * @example
    * // to view
    * acl.to('view')
    *
    * @param {array|string} actions - The name(s) of actions
    */
    SequelizeAcl.prototype.to = function(actions){

        if(typeof actions === 'string') this._actions = _.uniq([...this._actions, actions ]);

        if(Array.isArray(actions)) this._actions = _.uniq([...this._actions, ...actions ]);

        return this;
    }

    /**
     * Specify resources for current control
    *
    * @example
    * // add blog to current control
    * acl.on('blog')
    *
    * @param {array|string} resources - The name(s) of resources
    */
    SequelizeAcl.prototype.on = function(resources){

        if(typeof resources === 'string') this._resources = _.uniq([...this._resources, resources ]);

        if(Array.isArray(resources)) this._resources = _.uniq([...this._resources, ...resources ]);

        return this;
    }


    /**
     * Commit current control
    *
    * @example
    * //
    * acl.commit()
    *
    *  @param {Function} Callback called when finished.
    *  @return {Promise} Promise resolved when finished
    */
    SequelizeAcl.prototype.commit = async function(cb){

        let self = this;
        let roles = this._roles;
        let actions = this._actions

        const t = await this._sequelize.transaction();

        roles = roles.map(role => {
            return {
                name : role
            }
        });

        Promise.all(roles.map(function(role){
            return self._models.AclRole.create(role, { transaction: t });
        })).then(roles => {
            return roles.map(role => {
                return role.dataValues.id;
            })
        })
        .then(function(role_ids){
            console.log(role_ids);
            cb();
        });

        return this;
    }

    aclExtPermissions(SequelizeAcl);
    aclExtRoles(SequelizeAcl);
    aclExtUsers(SequelizeAcl);

    SequelizeAcl.migration = migration;
    SequelizeAcl.seeder = seeder;

    return SequelizeAcl;
}());


