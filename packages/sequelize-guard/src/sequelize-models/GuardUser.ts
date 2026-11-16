import {
  BelongsToManyAddAssociationMixin,
  BelongsToManyAddAssociationsMixin,
  BelongsToManyGetAssociationsMixin,
  BelongsToManyRemoveAssociationsMixin,
  CreationOptional,
  DataTypes,
  Model,
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

export interface GuardUserMethods {
  getRoles: BelongsToManyGetAssociationsMixin<GuardRoleModel>;
  addRole: BelongsToManyAddAssociationMixin<GuardRoleModel, number>;
  addRoles: BelongsToManyAddAssociationsMixin<GuardRoleModel, number>;
  removeRoles: BelongsToManyRemoveAssociationsMixin<GuardRoleModel, number>;
  can(permission: string): Promise<boolean>;
  cant(permission: string): Promise<boolean>;
  isA(role: string): Promise<boolean>;
  isAn(role: string): Promise<boolean>;
  isAllOf(roles: string[]): Promise<boolean>;
  isAnyOf(roles: string[]): Promise<boolean>;
  assignRole(role: string): Promise<this>;
  roles(): Promise<GuardRoleModel[]>;
  assignRoles(roles: string[]): Promise<void>;
  rmAssignedRoles(roles: string[]): Promise<void>;
}

export interface GuardUserModel
  extends SequelizeModelClass<GuardUserModel>,
    GuardUserMethods {
  id: CreationOptional<number>;
  Roles?: NonAttribute<GuardRoleModel[]>;
}

export type GuardUserModelStatic<TUser extends Model = GuardUserModel> =
  ModelStatic<TUser & GuardUserMethods>;

export const initOrSetupGuardUser = (
  params: GuardModelInitParams,
): GuardUserModelStatic<Model> => {
  const { sequelize, options } = params;

  const modelType = BaseModelType.Users;

  const tableName = getTableName(modelType, options);
  const schema = getGuardUserSchema();

  // Handle User Model - use custom or create default
  if (options.UserModel) {
    return options.UserModel as GuardUserModelStatic<Model>;
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
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
    },
  };

  return schema;
};
