var _ = require('lodash');

module.exports = (SequelizeAcl) => {

    SequelizeAcl.prototype.makeRole = async function(role){
        if(!role) throw new Error('Role must be string with length not zero');

        let roleData = makeRoleData(role);
        return this._models.AclRole.findOrCreate({ where : roleData }).then(([role, created])=>{
            return { role, created };
        });
    }

    SequelizeAcl.prototype.makeRoles = function(roles, options = {}){

        roles = sanitizeRolesInput(roles);

        return this._models.AclRole.findAll({
            where : { name: roles.map(d => d.name )}
        }).then(existRoles => {
            const roles2insert = _.differenceBy(roles, existRoles, (r) => r.name)

            return this._models.AclRole.bulkCreate(roles2insert)
                .then(roles => {
                    if (options.all){
                        roles = _.concat(existRoles, roles);
                    }
                    if(options.json){
                        return roles.map(role => {
                            return role.toJSON();
                        })
                    }
                    return roles;
                });
        })
    }

    SequelizeAcl.prototype.deleteRoles = function(roles){
        roles = sanitizeRolesInput(roles);

        return this._models.AclRole.destroy({
            where : { name: roles.map(d => d.name )}
        });
    }

    function sanitizeRolesInput(roles){
        if(typeof roles === 'string') {
            roles = [roles];
        }
        return roles.map(role => makeRoleData(role)).filter(role => {
            return (typeof role.name === 'string' && role.name.length > 0);   
        });
    }

    function makeRoleData(role){
        let roleData = {}
        if (typeof role === 'string') {
            roleData = {name : role};
        }
        else if (typeof role === 'object'){
            roleData = role;
        } 
        else{
            return {};
        } 
        
        return roleData;    
    }
}
