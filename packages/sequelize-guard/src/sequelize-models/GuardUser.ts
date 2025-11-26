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

/**
 * GuardUser Model - Can be custom or default
 */
export interface GuardUserModel extends SequelizeModelClass<GuardUserModel> {
  id: CreationOptional<number>;

  // Associations
  Roles?: NonAttribute<GuardRoleModel[]>;

  // Methods added by associations and guard extensions
  getRoles?: () => Promise<GuardRoleModel[]>;
  addRole?: (roleId: number) => Promise<void>;
  addRoles?: (roleIds: number[]) => Promise<void>;
  removeRoles?: (roles: GuardRoleModel[]) => Promise<void>;

  // Guard authorization methods (added by extensions)
  can?: (permission: string) => Promise<boolean>;
  cant?: (permission: string) => Promise<boolean>;
  isA?: (role: string) => Promise<boolean>;
  isAn?: (role: string) => Promise<boolean>;
  isAllOf?: (roles: string[]) => Promise<boolean>;
  isAnyOf?: (roles: string[]) => Promise<boolean>;

  /**
   * Assign single role to user
   * @param {{string}} role
   * @returns GuardUserModel
   */
  assignRole?: (role: string) => Promise<GuardUserModel>;

  /**
   * @deprecated Use `getRoles` association method instead
   */
  roles?: () => Promise<GuardRoleModel[]>;

  /**
   * Assign multiple roles to user
   * @param roles
   * @returns void
   */
  assignRoles?: (roles: string[]) => Promise<void>;
  /**
   * Remove assigned roles from user
   * @param roles
   * @returns void
   */
  rmAssignedRoles?: (roles: string[]) => Promise<void>;
}

export type GuardUserModelStatic = ModelStatic<GuardUserModel>;

export const initOrSetupGuardUser = (
  params: GuardModelInitParams,
): GuardUserModelStatic => {
  const { sequelize, options } = params;

  const modelType = BaseModelType.Users;

  const tableName = getTableName(modelType, options);
  const schema = getGuardUserSchema();

  // Handle User Model - use custom or create default
  if (options.UserModel) {
    return options.UserModel;
  }

  const GuardUser = sequelize.define<GuardUserModel>(
    ModelClassNameMap[modelType],
    schema,
    modelOptions(options, tableName),
  );

  return GuardUser;
};

export const getGuardUserSchema = () => {
  const schema: ModelAttributes<GuardUserModel> = {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
  };

  return schema;
};
