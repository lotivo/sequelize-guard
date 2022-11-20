'use strict';
const { DataTypes } = require('sequelize');
var { schemas, tablesMap } = require('../migrations/guard-schema');
var modelOptions = require('./modelOptions');

module.exports = (guard, options) => {
  const sequelize = guard._sequelize;

  const GuardResource = sequelize.define(
    'GuardResource',
    {
      ...schemas[tablesMap.resources],
    },
    {
      ...modelOptions(options),
      tableName: options.prefix + tablesMap.resources,
    }
  );

  const GuardPermission = sequelize.define(
    'GuardPermission',
    {
      ...schemas[tablesMap.permissions],
    },
    {
      ...modelOptions(options),
      tableName: options.prefix + tablesMap.permissions,
    }
  );

  const GuardRole = sequelize.define(
    'GuardRole',
    {
      ...schemas[tablesMap.roles],
    },
    {
      ...modelOptions(options),
      tableName: options.prefix + tablesMap.roles,
    }
  );

  GuardRole.hasMany(GuardRole, { as: 'ChildRoles', foreignKey: 'parent_id' });
  GuardRole.belongsTo(GuardRole, { foreignKey: 'parent_id', as: 'Parent' });

  const RolePermission = sequelize.define(
    'RolePermission',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      role_id: {
        type: DataTypes.INTEGER,
        references: {
          model: GuardRole,
          key: 'id',
        },
      },
      permission_id: {
        type: DataTypes.INTEGER,
        references: {
          model: GuardPermission,
          key: 'id',
        },
      },
    },
    {
      ...modelOptions(options),
      tableName: options.prefix + tablesMap.role_permission,
      indexes: [
        {
          unique: true,
          fields: ['role_id', 'permission_id'],
        },
      ],
    }
  );

  GuardRole.belongsToMany(GuardPermission, {
    through: 'RolePermission',
    as: 'Permissions',
    foreignKey: 'role_id',
  });
  GuardPermission.belongsToMany(GuardRole, {
    through: 'RolePermission',
    as: 'Roles',
    foreignKey: 'permission_id',
  });

  const GuardModels = {
    GuardResource,
    GuardRole,
    GuardPermission,
    RolePermission,
  };

  let GuardUser = options.UserModel;
  let userColId = `user_id`;
  let roleColId = `role_id`;

  if (!GuardUser) {
    GuardUser = sequelize.define(
      'User',
      {
        ...schemas['users'],
      },
      { tableName: `${options.prefix}users` }
    );
  }

  GuardModels.GuardUser = GuardUser;

  let roleUserSchema = {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
  };
  roleUserSchema[`${roleColId}`] = {
    type: DataTypes.INTEGER,
    references: {
      model: GuardRole,
      key: 'id',
    },
    onDelete: 'cascade',
  };
  roleUserSchema[`${userColId}`] = {
    type: DataTypes.INTEGER,
    references: {
      model: GuardUser,
      key: options.userPk,
    },
    onDelete: 'cascade',
  };

  const RoleUser = sequelize.define('RoleUser', roleUserSchema, {
    ...modelOptions(options),
    tableName: options.prefix + tablesMap.role_user,
    indexes: [
      {
        unique: true,
        fields: [roleColId, userColId],
      },
    ],
  });
  GuardModels.RoleUser = RoleUser;

  GuardRole.belongsToMany(GuardUser, {
    through: 'RoleUser',
    as: 'Users',
    foreignKey: roleColId,
  });
  GuardUser.belongsToMany(GuardRole, {
    through: 'RoleUser',
    as: 'Roles',
    foreignKey: userColId,
  });

  return GuardModels;
};
