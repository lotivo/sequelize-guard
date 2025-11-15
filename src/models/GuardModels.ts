import { DataTypes, ModelStatic } from 'sequelize';
import type { SequelizeGuard } from '../SequelizeGuard';
import type {
  GuardResourceModel,
  GuardPermissionModel,
  GuardRoleModel,
  RolePermissionModel,
  GuardUserModel,
  RoleUserModel,
  GuardModels,
} from '../types';
import { schemas, tablesMap } from '../migrations/guard-schema';
import { modelOptions } from './modelOptions';

/**
 * Initialize and return all Guard models
 */
export function initGuardModels(guard: SequelizeGuard): GuardModels {
  const sequelize = guard.sequelize;
  const options = guard.options;

  // Define GuardResource model
  const GuardResource = sequelize.define<GuardResourceModel>(
    'GuardResource',
    {
      ...(schemas[tablesMap.resources] as any),
    },
    {
      ...modelOptions(options),
      tableName: options.prefix + tablesMap.resources,
    },
  ) as ModelStatic<GuardResourceModel>;

  // Define GuardPermission model
  const GuardPermission = sequelize.define<GuardPermissionModel>(
    'GuardPermission',
    {
      ...(schemas[tablesMap.permissions] as any),
    },
    {
      ...modelOptions(options),
      tableName: options.prefix + tablesMap.permissions,
    },
  ) as ModelStatic<GuardPermissionModel>;

  // Define GuardRole model
  const GuardRole = sequelize.define<GuardRoleModel>(
    'GuardRole',
    {
      ...(schemas[tablesMap.roles] as any),
    },
    {
      ...modelOptions(options),
      tableName: options.prefix + tablesMap.roles,
    },
  ) as ModelStatic<GuardRoleModel>;

  // Set up Role self-associations for hierarchy
  GuardRole.hasMany(GuardRole, { as: 'ChildRoles', foreignKey: 'parent_id' });
  GuardRole.belongsTo(GuardRole, { foreignKey: 'parent_id', as: 'Parent' });

  // Define RolePermission junction model
  const RolePermission = sequelize.define<RolePermissionModel>(
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
          model: GuardRole.tableName,
          key: 'id',
        },
      },
      permission_id: {
        type: DataTypes.INTEGER,
        references: {
          model: GuardPermission.tableName,
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
    },
  ) as ModelStatic<RolePermissionModel>;

  // Set up Role-Permission many-to-many association
  GuardRole.belongsToMany(GuardPermission, {
    through: RolePermission,
    as: 'Permissions',
    foreignKey: 'role_id',
  });
  GuardPermission.belongsToMany(GuardRole, {
    through: RolePermission,
    as: 'Roles',
    foreignKey: 'permission_id',
  });

  // Handle User Model - use custom or create default
  let GuardUser: ModelStatic<GuardUserModel>;
  const userColId = 'user_id';
  const roleColId = 'role_id';

  if (options.UserModel) {
    GuardUser = options.UserModel as ModelStatic<GuardUserModel>;
  } else {
    GuardUser = sequelize.define<GuardUserModel>(
      'User',
      {
        ...(schemas.users as any),
      },
      {
        tableName: `${options.prefix}users`,
      },
    ) as ModelStatic<GuardUserModel>;
  }

  // Define RoleUser junction model
  const roleUserSchema = {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    [roleColId]: {
      type: DataTypes.INTEGER,
      references: {
        model: GuardRole.tableName,
        key: 'id',
      },
      onDelete: 'cascade',
    },
    [userColId]: {
      type: DataTypes.INTEGER,
      references: {
        model: GuardUser.tableName,
        key: options.userPk,
      },
      onDelete: 'cascade',
    },
  };

  const RoleUser = sequelize.define<RoleUserModel>('RoleUser', roleUserSchema, {
    ...modelOptions(options),
    tableName: options.prefix + tablesMap.role_user,
    indexes: [
      {
        unique: true,
        fields: [roleColId, userColId],
      },
    ],
  }) as ModelStatic<RoleUserModel>;

  // Set up Role-User many-to-many association
  GuardRole.belongsToMany(GuardUser, {
    through: RoleUser,
    as: 'Users',
    foreignKey: roleColId,
  });
  GuardUser.belongsToMany(GuardRole, {
    through: RoleUser,
    as: 'Roles',
    foreignKey: userColId,
  });

  return {
    GuardResource,
    GuardRole,
    GuardPermission,
    RolePermission,
    GuardUser,
    RoleUser,
  };
}
