var _ = require('lodash');
var { Op } = require('sequelize');

module.exports = (SequelizeAcl) => {
  SequelizeAcl.prototype.makeRole = async function (role) {
    if (!role) throw new Error('Role must be string with length not zero');

    let _acl = this;

    let roleData = makeRoleData(role);

    return this.getCache()
      .then((cache) => {
        roles = cache.get('roles');
        return _.find(roles, roleData);
      })
      .then((role) => {
        if (role) {
          return { role, created: false };
        }

        return this._models.AclRole.findOrCreate({ where: roleData }).then(
          ([role, created]) => {
            _acl._ee.emit('onRolesCreated', [role]);
            return { role, created };
          }
        );
      });
  };

  SequelizeAcl.prototype.makeRoles = function (roles, options = {}) {
    let _acl = this;
    roles = sanitizeRolesInput(roles);
    let roles2insert = [...roles];

    return this.getCache()
      .then((cache) => {
        let existRoles = _.values(cache.get('roles'));
        let rNames = existRoles.map((d) => d.name);
        rNames = _.remove(roles2insert, (r) => rNames.indexOf(r.name) >= 0).map(
          (d) => d.name
        );
        return _.filter(existRoles, (r) => rNames.indexOf(r.name) >= 0);
      })
      .then((existRoles) => {
        return this._models.AclRole.bulkCreate(roles2insert).then(
          (insertedRoles) => {
            let roles = insertedRoles;
            if (insertedRoles.length) {
              _acl._ee.emit('onRolesCreated', insertedRoles);
            }
            if (options.json) {
              roles = roles.map((role) => {
                return role.toJSON();
              });
            }
            if (options.all) {
              roles = _.concat(existRoles, roles);
            }
            return roles;
          }
        );
      });
  };

  SequelizeAcl.prototype.deleteRoles = function (roles) {
    let _acl = this;

    roles = sanitizeRolesInput(roles);

    return this.getCache()
      .then((cache) => {
        let cacheRoles = cache.get('roles');
        let roleNames = roles.map((d) => d.name);
        return _.filter(cacheRoles, function (role) {
          return roleNames.indexOf(role.name) >= 0;
        });
      })
      .then((roles) => {
        if (!roles.length) return 0;
        return this._models.AclRole.destroy({
          where: { name: roles.map((d) => d.name) },
        }).then((r) => {
          _acl._ee.emit('onRolesDeleted', roles);
          return r;
        });
      });
  };

  SequelizeAcl.prototype.allRoles = function () {
    return this.getCache().then((cache) => _.values(cache.get('roles')));
  };
  SequelizeAcl.prototype.findRoles = async function (args = {}) {
    let _acl = this;
    let wheres = [];
    let cond = { where: {} };

    if (args.names && args.names.length) {
      if (args.search) {
        args.names.forEach((name) => {
          wheres.push({ name: { [Op.substring]: name } });
        });
      } else {
        args.names.forEach((name) => {
          wheres.push({ [Op.or]: { name: name } });
        });
      }
    } else if (args.name) {
      wheres.push({ name: args.name });
    }

    if (wheres.length > 0) {
      cond.where = {
        [Op.or]: wheres,
      };
    }

    if (args.withParent) {
      cond.include = 'Parent';
    }

    let roles = await _acl.models().AclRole.findAll(cond);

    return roles;
  };

  function sanitizeRolesInput(roles) {
    if (typeof roles === 'string') {
      roles = [roles];
    }
    return roles
      .map((role) => makeRoleData(role))
      .filter((role) => {
        return typeof role.name === 'string' && role.name.length > 0;
      });
  }

  function makeRoleData(role) {
    let roleData = {};
    if (typeof role === 'string') {
      roleData = { name: role.toLowerCase() };
    } else if (typeof role === 'object') {
      roleData = role;
      roleData.name = roleData.name.toLowerCase();
    } else {
      return {};
    }

    return roleData;
  }

  SequelizeAcl.prototype.onRolesCreated = function (fn) {
    return this.on('onRolesCreated', fn);
  };
  SequelizeAcl.prototype.onRolesDeleted = function (fn) {
    return this.on('onRolesDeleted', fn);
  };
  SequelizeAcl.prototype.onPermsAssigned = function (fn) {
    return this.on('onPermsAssigned', fn);
  };
};
