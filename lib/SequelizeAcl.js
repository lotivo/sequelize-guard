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

var aclAuthorize = require("./authorize/AclAuthorize");
var AclControl = require('./acl/AclControl');

module.exports = (function(){

    function SequelizeAcl(seql, options) {

        this._sequelize = seql;
        seql.acl = this;
        
        var opts = _.extend({}, defaultOpts, options);
        this._options = opts;
        
        this._models = aclModels(this, this._options);
        seql.models.AclModels = this._models;
        aclUserAssociations(this);

        if (opts.sync === true) {
            _.each(this._models, function(model, name) {
                model.sync({
                    logging: this._options.debug ? console.log : false
                });
            }.bind(this));
        }

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
        return new AclControl(this);
    }

    //TODO: add test cases
    SequelizeAcl.prototype.allow = function(role, actions, resources){
        return this.init().allow(role).to(actions).on(resources).commit();
    }

    aclExtPermissions(SequelizeAcl);
    aclExtRoles(SequelizeAcl);
    aclExtUsers(SequelizeAcl);
    aclAuthorize(SequelizeAcl);

    SequelizeAcl.migration = migration;
    SequelizeAcl.seeder = seeder;

    return SequelizeAcl;
}());
