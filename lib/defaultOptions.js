var defaultOpts = {
  tables: {
    meta: 'meta',
    parents: 'parents',
    permissions: 'permissions',
    resources: 'resources',
    roles: 'roles',
    users: 'users',
  },
  prefix: 'guard_',
  primaryKey: 'id',
  timestamps: false,
  paranoid: false,
  sync: true,
  debug: false,
  UserModel: null,
  userPk: 'id', //User Primary Key
  safeGuardDeletes: true,
  userCache: true,
  userCacheTtl: 60,
};

module.exports = defaultOpts;
