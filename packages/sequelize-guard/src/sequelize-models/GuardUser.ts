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

/** Authorization and role methods attached to guard user instances. */
export interface GuardUserMethods {
  /** Read roles through the Sequelize association, with its normal query options. */
  getRoles: BelongsToManyGetAssociationsMixin<GuardRoleModel>;
  /** Add a role through the Sequelize association. */
  addRole: BelongsToManyAddAssociationMixin<GuardRoleModel, number>;
  /** Add roles through the Sequelize association. */
  addRoles: BelongsToManyAddAssociationsMixin<GuardRoleModel, number>;
  /** Remove roles through the Sequelize association. */
  removeRoles: BelongsToManyRemoveAssociationsMixin<GuardRoleModel, number>;
  /**
   * Check direct and inherited permissions in the writer database; query errors reject.
   * @param permission - Permission in `action resource` form, or `*`.
   * @returns Whether access is granted; malformed requests return false.
   */
  can(permission: string): Promise<boolean>;
  /**
   * Negate can(); database errors still reject.
   * @param permission - Permission in `action resource` form, or `*`.
   * @returns Whether access is denied.
   */
  cant(permission: string): Promise<boolean>;
  /**
   * Check active direct membership; inherited roles are excluded.
   * @param role - Role name.
   */
  isA(role: string): Promise<boolean>;
  /**
   * Alias for isA().
   * @param role - Role name.
   */
  isAn(role: string): Promise<boolean>;
  /**
   * Check every direct role membership; an empty list returns true.
   * @param roles - Role names.
   */
  isAllOf(roles: string[]): Promise<boolean>;
  /**
   * Check any direct role membership; an empty list returns false.
   * @param roles - Role names.
   */
  isAnyOf(roles: string[]): Promise<boolean>;
  /**
   * Assign a direct role, restoring an archived assignment if needed.
   * @param role - Role name; created if absent.
   * @returns This user.
   */
  assignRole(role: string): Promise<this>;
  /**
   * Read active direct roles from the writer database.
   * @returns Role models without junction data; inherited roles are excluded.
   */
  roles(): Promise<GuardRoleModel[]>;
  /**
   * Assign direct roles, restoring archived assignments if needed.
   * @param roles - Role names; created if absent.
   */
  assignRoles(roles: string[]): Promise<void>;
  /**
   * Remove direct role assignments.
   * @param roles - Role names.
   */
  rmAssignedRoles(roles: string[]): Promise<void>;
}

/** Built-in guard user model with direct role associations. */
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
