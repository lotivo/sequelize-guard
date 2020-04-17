module.exports = (SequelizeAcl) => {
    /**
     * Make User
     *
     * @example
     * // make a user
     * acl.makePermission('blog','view')
     *
     *
     * @param {array|string} user - The name(s) of role
     * @param {array|string} roles - The name(s) of role
     */
    SequelizeAcl.prototype.makeUser = function(user, options = {}){

        // if(!this._models.AclUser){
        //     throw new Error("Use this function when UserModel is passed in options");
        // }

        return this._models.AclUser.create({
            name : user.name,
            email: user.email
        })
    }

    SequelizeAcl.prototype.assignRole = function(user, roles){
        return user.assignRole(roles)
    }

    SequelizeAcl.prototype.assignRoles = function(user, roles){
        return user.assignRoles(roles)
    }

    SequelizeAcl.prototype.rmAssignedRoles = function(user, roles){
        return user.rmAssignedRoles(roles)
    }


}
