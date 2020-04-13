module.exports = (SequelizeAcl) => {
    /**
     * Make User
     *
     * @example
     * // create permission to view blog
     * acl.makePermission('blog','view')
     *
     *
     * @param {array|string} user - The name(s) of role
     * @param {array|string} roles - The name(s) of role
     */
    SequelizeAcl.prototype.makeUser = function(user, options = {}, cb){

        if(!this._models.AclUser){
            throw new Error("Use this function when UserModel is passed in options");
        }

        return this._models.AclUser.create({
            name : user.name,
            email: user.email
        })
    }


}
