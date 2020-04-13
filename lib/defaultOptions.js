var defaultOpts = {
    tables : {
        meta: 'meta',
        parents: 'parents',
        permissions: 'permissions',
        resources: 'resources',
        roles: 'roles',
        users: 'users',
    },
    prefix : "acl_",
    primaryKey : 'id',
    timestamps : false,
    paranoid : false,
    sync: true,
    debug: false,
    userModel: null,
    userPk : 'id', //User Primary Key
};

module.exports = defaultOpts;
