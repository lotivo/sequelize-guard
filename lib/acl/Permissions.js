var _ = require('lodash');

module.exports = (SequelizeAcl) => {
    
    /**
     * Create Permissions
     *
     * @example
     * // create permissions to view blog
     * acl.createPermissions('blog','view')
     *
     * // create permissions to view blog
     * acl.createPermissions('blog','view')
     *
     *
     * @param {string} resources - The name of resource
     * @param {array|string} actions - The name(s) of actions
     * @param {object} options - options 
     * @param {string} options.name - name for permission 
     * 
     */
    SequelizeAcl.prototype.createPermissions = function(resources, actions, options = {}){
        let _acts = [], _res = [];
        if(typeof resources === 'string') _res = [resources];
        if(Array.isArray(resources)) _res = resources;

        if(typeof actions === 'string') _acts = [actions];
        if(Array.isArray(actions)) _acts = actions;

        if(!options.names) options.names = [];

        let permissions = _res.map((r, i) => {
            return {
                name : options.names[i] || `${r}:[${_acts.toString()}]`,
                resource : r,
                action : JSON.stringify(_acts)
            }
        })

            return this._models.AclPermission.findAll({
                where : { name: permissions.map(d => d.name )},
                // transaction : t
            }).then(existPerms => {
                let perms2insert = _.differenceBy(permissions, existPerms, (r) => r.name)
                
                return this._models.AclPermission.bulkCreate(perms2insert, {
                    // transaction:t 
                })
                    .then(perms => {
                        if (options.all){
                            perms = _.concat(existPerms, perms);
                        }
                        if(options.json){
                            return perms.map(perm => {
                                return perm.toJSON();
                            })
                        }
                        
                        return perms;
                    });
            });
    }

}
