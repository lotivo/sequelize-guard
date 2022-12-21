'use strict';
const { DataTypes } = require('sequelize');
const { schemas, tablesMap } = require('../migrations/guard-schema');
const modelOptions = require('./modelOptions');

module.exports = (guard) => {
  const sequelize = guard._sequelize;
  const options = guard._options;
  const schema = schemas(options);
  const ModelOptions = modelOptions(options);

  const GuardResource = sequelize.define(
    'GuardResource',
    {
      ...schema[tablesMap.resources],
    },
    {
      ...ModelOptions,
      tableName: options.prefix + tablesMap.resources,
    }
  );

  const GuardPermission = sequelize.define(
    'GuardPermission',
    {
      ...schema[tablesMap.permissions],
    },
    {
      ...ModelOptions,
      tableName: options.prefix + tablesMap.permissions,
    }
  );

  const GuardRole = sequelize.define(
    'GuardRole',
    {
      ...schema[tablesMap.roles],
    },
    {
      ...ModelOptions,
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
      ...ModelOptions,
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
  const userColId = options.UserModel.name + "_" + options.userPk;
  const roleColId = `role_id`;

  GuardModels.GuardUser = GuardUser;

  const RoleUser = sequelize.define('RoleUser', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
  }, {
    ...ModelOptions,
    tableName: options.prefix + tablesMap.role_user,
    indexes: [
      {
        unique: true,
        fields: [roleColId, userColId],
      },
    ],
  });

  RoleUser.belongsTo(GuardUser, { foreignKey: userColId, onUpdate: "cascade", onDelete: "cascade" });
  GuardUser.hasMany(RoleUser, { foreignKey: userColId });

  RoleUser.belongsTo(GuardRole, { foreignKey: roleColId, onUpdate: "cascade", onDelete: "cascade" });
  GuardRole.hasMany(RoleUser, { foreignKey: roleColId });

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
