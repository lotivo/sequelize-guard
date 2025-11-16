import {
  CreationOptional,
  DataTypes,
  ForeignKey,
  ModelAttributeColumnReferencesOptions,
  ModelAttributes,
  ModelStatic,
} from 'sequelize';
import { GuardModelInitParams, SequelizeModelClass } from './types/types';
import { modelOptions } from './utils';
import { GuardRoleModel, GuardRoleModelStatic } from './GuardRole';
import {
  GuardPermissionModel,
  GuardPermissionModelStatic,
} from './GuardPermission';
import {
  AssociationModelType,
  getTableName,
  ModelClassNameMap,
} from './types/ModelType';

/**
 * RolePermission Junction Model
 */
export interface RolePermissionModel
  extends SequelizeModelClass<RolePermissionModel> {
  id: CreationOptional<number>;
  role_id: ForeignKey<GuardRoleModel['id']>;
  permission_id: ForeignKey<GuardPermissionModel['id']>;
}

export type GuardRolePermissionModelStatic = ModelStatic<RolePermissionModel>;

export const initGuardRolePermission = (
  params: GuardModelInitParams,
  models: {
    GuardRole: GuardRoleModelStatic;
    GuardPermission: GuardPermissionModelStatic;
  },
): GuardRolePermissionModelStatic => {
  const { sequelize, options } = params;
  const { GuardRole, GuardPermission } = models;

  const modelType = AssociationModelType.RolePermission;

  const tableName = getTableName(modelType, options);
  const schema = getGuardRolePermissionSchema({
    roleReference: {
      model: GuardRole,
      key: 'id',
    },
    permissionReference: {
      model: GuardPermission,
      key: 'id',
    },
  });

  // Define RolePermission junction model
  const RolePermission = sequelize.define<RolePermissionModel>(
    ModelClassNameMap[modelType],
    schema,
    {
      ...modelOptions(options, tableName),
      indexes: [
        {
          unique: true,
          fields: ['role_id', 'permission_id'],
        },
      ],
    },
  );

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

  return RolePermission;
};

export const getGuardRolePermissionSchema = (params?: {
  roleReference?: ModelAttributeColumnReferencesOptions;
  permissionReference?: ModelAttributeColumnReferencesOptions;
}) => {
  const { roleReference, permissionReference } = params || {};

  const schema: ModelAttributes<RolePermissionModel> = {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    role_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: roleReference,
    },
    permission_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: permissionReference,
    },
  };

  return schema;
};
