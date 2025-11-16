import {
  CreationOptional,
  DataTypes,
  ForeignKey,
  ModelAttributes,
  ModelStatic,
  NonAttribute,
} from 'sequelize';
import { modelOptions } from './utils';
import { GuardModelInitParams, SequelizeModelClass } from './types/types';
import {
  BaseModelType,
  getTableName,
  ModelClassNameMap,
} from './types/ModelType';
import { GuardPermissionModel } from './GuardPermission';
import { GuardUserModel } from './GuardUser';

/**
 * GuardPermission Model - Represents permissions (e.g., view blog, edit post)
 */
export interface GuardRoleModel extends SequelizeModelClass<GuardRoleModel> {
  id: CreationOptional<number>;
  name: string;
  description?: string;
  parent_id?: ForeignKey<GuardRoleModel['id']>;

  // Associations
  Permissions?: NonAttribute<GuardPermissionModel[]>;
  Users?: NonAttribute<GuardUserModel[]>;
  ChildRoles?: NonAttribute<GuardRoleModel[]>;
  Parent?: NonAttribute<GuardRoleModel>;

  // Methods added by associations
  getPermissions?: () => Promise<GuardPermissionModel[]>;
  addPermissions?: (
    permissions: (GuardPermissionModel | number)[],
  ) => Promise<void>;
  removePermissions?: (
    permissions: (GuardPermissionModel | number)[],
  ) => Promise<void>;
  getRoles?: () => Promise<GuardRoleModel[]>;
  addRole?: (roleId: number) => Promise<void>;
  addRoles?: (roleIds: number[]) => Promise<void>;
  removeRoles?: (roles: GuardRoleModel[]) => Promise<void>;
}

export type GuardRoleModelStatic = ModelStatic<GuardRoleModel>;

export const initGuardRole = (
  params: GuardModelInitParams,
): GuardRoleModelStatic => {
  const { sequelize, options } = params;

  const modelType = BaseModelType.Roles;

  const tableName = getTableName(modelType, options);
  const schema = getGuardRoleSchema();

  const GuardRole = sequelize.define<GuardRoleModel>(
    ModelClassNameMap[modelType],
    schema,
    modelOptions(options, tableName),
  );

  // Set up Role self-associations for hierarchy
  GuardRole.hasMany(GuardRole, { as: 'ChildRoles', foreignKey: 'parent_id' });
  GuardRole.belongsTo(GuardRole, { foreignKey: 'parent_id', as: 'Parent' });

  return GuardRole;
};

export const getGuardRoleSchema = () => {
  const schema: ModelAttributes<GuardRoleModel> = {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    parent_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  };

  return schema;
};

export type GuardRoleSerializable = ReturnType<GuardRoleModel['toJSON']>;
