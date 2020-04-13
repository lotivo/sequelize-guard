module.exports = (SequelizeAcl) => {
    /**
     * Make Permission
     *
     * @example
     * // create permission to view blog
     * acl.makePermission('blog','view')
     *
     *
     * @param {array|string} roles - The name(s) of role
     */
    SequelizeAcl.prototype.makePermission = function(resource, actions, options = {}, cb){
        let _acts = [];
        if(typeof actions === 'string') _acts = [actions];
        if(Array.isArray(actions)) _acts = actions;

        if(!options.name) options.name = `${resource}:[${_acts.toString()}]`;

        return this._models.AclPermission.create({
            name : options.name,
            resource : resource,
            action : JSON.stringify(_acts)
        });

    }


}
