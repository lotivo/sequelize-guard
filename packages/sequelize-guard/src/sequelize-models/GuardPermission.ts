import {
  CreationOptional,
  DataTypes,
  ModelAttributes,
  ModelStatic,
  NonAttribute,
} from 'sequelize';
import { GuardRoleModel } from './GuardRole';
import {
  BaseModelType,
  getTableName,
  ModelClassNameMap,
} from './types/ModelType';
import { GuardModelInitParams, SequelizeModelClass } from './types/types';
import { modelOptions } from './utils';

/** Stored permission bundle for one resource and a set of actions. */
export interface GuardPermissionData {
  id: CreationOptional<number>;
  /** Bundle name; generated when omitted during creation. */
  name: string | null;
  description?: string | null;
  /** Resource token, or `*` for all resources. */
  resource: string;
  /** JSON-encoded array of action tokens, including `*` for all actions. */
  action: string;
  /** @deprecated Reserved for compatibility. Guard permissions only grant access. */
  allow?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

/**
 * GuardPermission Model - Represents permissions (e.g., view blog, edit post)
 */
export interface GuardPermissionModel
  extends SequelizeModelClass<GuardPermissionModel>,
    GuardPermissionData {
  // Associations
  Roles?: NonAttribute<GuardRoleModel[]>;
}

export type GuardPermissionModelStatic = ModelStatic<GuardPermissionModel>;

export const initGuardPermission = (
  params: GuardModelInitParams,
): GuardPermissionModelStatic => {
  const { sequelize, options } = params;

  const modelType = BaseModelType.Permissions;

  const tableName = getTableName(modelType, options);
  const schema = getGuardPermissionSchema();

  // Define GuardPermission model
  const GuardPermission = sequelize.define<GuardPermissionModel>(
    ModelClassNameMap[modelType],
    schema,
    modelOptions(options, tableName),
  );

  return GuardPermission;
};

export const getGuardPermissionSchema = () => {
  const schema: ModelAttributes<GuardPermissionModel> = {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    resource: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    action: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    allow: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 1,
    },
  };

  return schema;
};
