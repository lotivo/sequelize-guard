'use strict';
const { DataTypes } = require('sequelize');
var { schemas, tablesMap } = require('../migrations/guard-schema');
var modelOptions = require('./modelOptions');

module.exports = (guard, options) => {
  const sequelize = guard._sequelize;
  const schema = schemas(options);

  const GuardResource = sequelize.define(
    'GuardResource',
    {
      ...schema[tablesMap.resources],
    },
    {
      ...modelOptions(options),
      tableName: options.prefix + tablesMap.resources,
    }
  );

  const GuardPermission = sequelize.define(
    'GuardPermission',
    {
      ...schema[tablesMap.permissions],
    },
    {
      ...modelOptions(options),
      tableName: options.prefix + tablesMap.permissions,
    }
  );

  const GuardRole = sequelize.define(
    'GuardRole',
    {
      ...schema[tablesMap.roles],
    },
    {
      ...modelOptions(options),
      tableName: options.prefix + tablesMap.roles,
    }
  );

  GuardRole.hasMany(GuardRole, { as: 'ChildRoles', foreignKey: 'parent_id' });
  GuardRole.belongsTo(GuardRole, { foreignKey: 'parent_id', onUpdate: "cascade", onDelete: "cascade", as: 'Parent' });

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
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        references: {
          model: GuardRole,
          key: 'id',
        },
      },
      permission_id: {
        type: DataTypes.INTEGER,
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
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

  const GuardUser = options.UserModel;
  let userColId = `${options.UserModel.name}_${options.userPk}`;
  let roleColId = `role_id`;

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
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
    references: {
      model: GuardRole,
      key: 'id',
    },
    onDelete: 'cascade',
  };
  roleUserSchema[`${userColId}`] = {
    type: GuardUser.getAttributes()[options.userPk].type,
    references: {
      model: GuardUser,
      key: options.userPk,
    },
    onDelete: 'cascade',
    onUpdate: "cascade"
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
