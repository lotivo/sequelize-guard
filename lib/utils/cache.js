var _ = require('lodash');
const NodeCache = require('node-cache');

const mappedPermsToIds = function (objects, id = 'id') {
  if (!objects) return {};
  let mappedObj = {};
  objects.forEach((obj) => {
    mappedObj[obj[id]] = obj.toJSON();
  });
  return mappedObj;
};
const mappedRolesToIds = function (objects, id = 'id') {

  if (!objects) return {};
  
  let mappedObj = {};
  objects.forEach((obj) => {
    const data = obj.toJSON();
    if (obj.Permissions) {
      data.Permissions = obj.Permissions.map((perm) =>
        perm.toJSON ? perm.toJSON() : perm
      );
    } else {
      data.Permissions = false;
    }
    mappedObj[obj[id]] = data;
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
NodeCache.prototype.getRolesWithPerms = async function (guard) {
  let cache = this;
  let cRoles = _.values(cache.getRoles());

  let r2Fetch = cRoles
    .filter((role) => !role.Permissions)
    .map((role) => role.id);

  return guard
    .models()
    .GuardRole.findAll({
      where: { id: r2Fetch },
      include: 'Permissions',
    })
    .then((roles) => {
      let mappedRoles = mappedRolesToIds(roles);

      let roles2Save = {
        ...cache.getRoles(),
        ...mappedRoles,
      };
      cache.setRoles(roles2Save);
      return roles2Save;
    });
};

const extCache = (SequelizeGuard) => {
  SequelizeGuard.prototype.resetCache = function () {
    if (!this._cache) {
      this._cache = new NodeCache();
    }
    this._cache.flushAll();
    return this._cache;
  };

  SequelizeGuard.prototype.getCache = async function () {
    return new Promise(async (resolve, reject) => {
      if (!this._cache) {
        cache = this.resetCache();
        let roles = await this.models()
          .GuardRole.findAll({
            include: 'Permissions',
          })
          .catch(() => guardMigrationErrShow());
          let mappedRoles = mappedRolesToIds(roles);
          console.log("WORKED TO HERE!");          

        let perms = await this.models()
          .GuardPermission.findAll()
          .catch(() => guardMigrationErrShow());
        let mappedPerms = mappedPermsToIds(perms);

        console.log("<MAPPED>",mappedRoles, mappedPerms);

        cache.setRoles(mappedRoles);
        cache.setPerms(mappedPerms);
        console.log('cache stats : init', cache.getStats());
        this._cache = cache;

        bindGuardListeners(this);
      }
      resolve(this._cache);
    });
  };
};

function bindGuardListeners(guard) {
  let cache = guard._cache;

  guard.onRolesCreated(function (roles) {
    roles = roles.map((role) => {
      role.Permissions = false;
      role.dataValues.Permissions = false;
      return role;
    });

    let mappedRoles = mappedRolesToIds(roles);

    cache.setRoles({
      ...cache.getRoles(),
      ...mappedRoles,
    });
    // console.log('cache stats : init', cache.getStats());
  });

  guard.onRolesDeleted(function (roles) {
    let existRoles = cache.getRoles();
    roles.forEach((role) => delete existRoles[role.id]);
    cache.setRoles(existRoles);
    // console.log('cache stats : onRolesDeleted :', cache.getStats());
  });

  guard.onPermsCreated(function (perms) {
    let mappedPerms = mappedPermsToIds(perms);
    cache.setPerms({
      ...cache.getPerms(),
      ...mappedPerms,
    });
    // console.log('cache stats : onPermsCreated :', cache.getStats());
  });

  guard.onPermsAddedToRole(function (role) {
    let roles = [role];
    let mappedRoles = mappedRolesToIds(roles);
    cache.setRoles({
      ...cache.getRoles(),
      ...mappedRoles,
    });
    // console.log('cache stats : onPermsAddedToRole : ', cache.getStats());
  });

  guard.onPermsRemovedFromRole(function (role) {
    let roles = [role];
    let mappedRoles = mappedRolesToIds(roles);
    cache.setRoles({
      ...cache.getRoles(),
      ...mappedRoles,
    });
    // console.log('cache stats : onPermsAddedToRole : ', cache.getStats());
  });
}

function guardMigrationErrShow() {
  console.log('====================================');
  console.log(
    '\tTables for Guard not created, make sure you have run migrations or enabled sync option'
  );
  console.log('====================================');
}

// extCache.mappedToIds = mappedToIds;
module.exports = extCache;
