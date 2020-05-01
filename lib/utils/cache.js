var _ = require('lodash');
const NodeCache = require('node-cache');

const mappedToIds = function (objects, id = 'id') {
  if (!objects) return {};
  let mappedObj = {};
  objects.forEach((obj) => {
    if (obj.Permissions) {
      obj.Permissions = obj.Permissions.map((perm) => {
        // if (perm.sequelize) {
        perm = perm.toJSON();
        // }
        return perm;
      });
      obj.dataValues.Permissions = obj.Permissions;
    }
    mappedObj[obj[id]] = obj.toJSON();
  });

  return mappedObj;
};
NodeCache.prototype.getRoles = function () {
  return this.get('roles');
};
NodeCache.prototype.getPerms = function () {
  return this.get('perms');
};
NodeCache.prototype.setRoles = function (roles) {
  return this.set('roles', roles);
};
NodeCache.prototype.setPerms = function (perms) {
  return this.set('perms', perms);
};
NodeCache.prototype.getRolesWithPerms = async function (acl) {
  let cache = this;
  let cRoles = _.values(cache.getRoles());

  let r2Fetch = cRoles
    .filter((role) => !role.Permissions)
    .map((role) => role.id);

  return acl
    .models()
    .AclRole.findAll({
      where: { id: r2Fetch },
      include: 'Permissions',
    })
    .then((roles) => {
      let mappedRoles = mappedToIds(roles);

      let roles2Save = {
        ...cache.getRoles(),
        ...mappedRoles,
      };
      cache.setRoles(roles2Save);
      return roles2Save;
    });
};

const extCache = (SequelizeAcl) => {
  SequelizeAcl.prototype.resetCache = function () {
    if (!this._cache) {
      this._cache = new NodeCache();
    }
    this._cache.flushAll();
    return this._cache;
  };

  SequelizeAcl.prototype.getCache = async function () {
    return new Promise(async (resolve, reject) => {
      if (!this._cache) {
        cache = this.resetCache();
        let roles = await this.models()
          .AclRole.findAll({
            include: 'Permissions',
          })
          .catch(() => aclMigrationErrShow());
        let mappedRoles = mappedToIds(roles);

        let perms = await this.models()
          .AclPermission.findAll()
          .catch(() => aclMigrationErrShow());
        let mappedPerms = mappedToIds(perms);

        cache.setRoles(mappedRoles);
        cache.setPerms(mappedPerms);
        // console.log('cache stats : init', cache.getStats());

        bindAclListeners(this);
      }
      resolve(this._cache);
    });
  };
};

function bindAclListeners(acl) {
  let cache = acl._cache;

  acl.onRolesCreated(function (roles) {
    roles = roles.map((role) => {
      role.Permissions = false;
      role.dataValues.Permissions = false;
      return role;
    });

    let mappedRoles = mappedToIds(roles);

    cache.setRoles({
      ...cache.getRoles(),
      ...mappedRoles,
    });
    // console.log('cache stats : init', cache.getStats());
  });

  acl.onRolesDeleted(function (roles) {
    let existRoles = cache.getRoles();
    roles.forEach((role) => delete existRoles[role.id]);
    cache.setRoles(existRoles);
    // console.log('cache stats : onRolesDeleted :', cache.getStats());
  });

  acl.onPermsCreated(function (perms) {
    let mappedPerms = mappedToIds(perms);
    cache.setPerms({
      ...cache.getPerms(),
      ...mappedPerms,
    });
    // console.log('cache stats : onPermsCreated :', cache.getStats());
  });

  acl.onPermsAssigned(function (role) {
    let roles = [role];
    let mappedRoles = mappedToIds(roles);
    cache.setRoles({
      ...cache.getRoles(),
      ...mappedRoles,
    });
    // console.log('cache stats : onPermsAssigned : ', cache.getStats());
  });
}

function aclMigrationErrShow() {
  console.log('====================================');
  console.log(
    '\tTable for ACL not created, make sure you have run migrations or enabled sync option'
  );
  console.log('====================================');
}

extCache.mappedToIds = mappedToIds;
module.exports = extCache;
