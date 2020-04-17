var _ = require('lodash');
var Sequelize = require('sequelize');
var migration = require('./migrations/acl-migrations');
var seeder = require('./seeder');
var defaultOpts = require('./defaultOptions');
var aclModels = require("./models/AclModels");

var aclExtRoles = require('./acl/Roles');
var aclExtPermissions = require('./acl/Permissions');
var aclExtUsers = require('./acl/Users');
var aclUserAssociations = require("./acl/AclUserAssociations");

module.exports = (function(){

    function SequelizeAcl(seql, options) {

        this._sequelize = seql;
        seql.acl = this;

        var opts = _.extend(defaultOpts, options);
        this._options = opts;

        this._models = aclModels(seql, this._options);
        aclUserAssociations(this);

        if (opts.sync === true) {
            _.each(this._models, function(model, name) {
                model.sync({
                    logging: this._options.debug ? console.log : false
                });
            }.bind(this));
        }

        this._control = {};
        this._control._roles = [];
        this._control._actions = [];
        this._control._resources = [];

    }

    /**
     * start new control statement
    *
    * @example
    * // empty previous specification
    * acl.start()
    *
    */
    SequelizeAcl.prototype.init = function(){
        this._control._roles = [];
        this._control._actions = [];
        this._control._resources = [];
        return this;
    }

    /**
     * Specify role to allow
    *
    * @example
    * // allow admin
    * acl.allow('admin')
    *
    *
    * @param {string} roles - The name of role
    */
    SequelizeAcl.prototype.allow = function(roles){
        
        if(typeof roles === 'string') this._control._roles = roles;
        // if(typeof roles === 'string') this._control._roles = _.uniq([...this._control._roles, roles ])
        // if(Array.isArray(roles)) {
        //     this._control._roles = _.uniq([...this._control._roles, ...roles ])
        // }
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

        if(typeof actions === 'string') this._control._actions = _.uniq([...this._control._actions, actions ]);

        if(Array.isArray(actions)) this._control._actions = _.uniq([...this._control._actions, ...actions ]);

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

        if(typeof resources === 'string') this._control._resources = _.uniq([...this._control._resources, resources ]);

        if(Array.isArray(resources)) this._control._resources = _.uniq([...this._control._resources, ...resources ]);

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
    SequelizeAcl.prototype.commit = async function(){

        let self = this;
        let roles = this._control._roles;
        let actions = this._control._actions;
        let resources = this._control._resources;

        // const t = await this._sequelize.transaction();

        return this.createPermissions(resources, actions, {all :true}).then((perms)=> {

            return this.makeRole(roles).then(({role})=>{

                return role.getPermissions().then((assignedPerms)=> {
                    let perms2add = _.differenceBy(perms, assignedPerms, (r) => r.name)

                    return role.addPermissions(perms2add).then(()=>{
                        return {
                            role,
                            permissions : [...assignedPerms, ...perms2add] 
                        }
                    });
                });
            });
        })
    }

    aclExtPermissions(SequelizeAcl);
    aclExtRoles(SequelizeAcl);
    aclExtUsers(SequelizeAcl);

    SequelizeAcl.migration = migration;
    SequelizeAcl.seeder = seeder;

    return SequelizeAcl;
}());


