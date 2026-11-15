import {
  AbstractDataType,
  CreationOptional,
  DataTypes,
  ForeignKey,
  ModelAttributeColumnReferencesOptions,
  ModelAttributes,
  ModelStatic,
} from 'sequelize';
import { guardIndexes } from './guard-indexes';
import { GuardRoleModel, GuardRoleModelStatic } from './GuardRole';
import { GuardUserModelStatic } from './GuardUser';
import {
  AssociationModelType,
  getTableName,
  ModelClassNameMap,
} from './types/ModelType';
import { GuardModelInitParams, SequelizeModelClass } from './types/types';
import type { UserKey } from './user-key';
import { modelOptions } from './utils';

/**
 * RoleUser Junction Model
 */
export interface RoleUserModel extends SequelizeModelClass<RoleUserModel> {
  id: CreationOptional<number>;
  role_id: ForeignKey<GuardRoleModel['id']>;
  user_id: ForeignKey<string | number>;
}

export type GuardRoleUserModelStatic = ModelStatic<RoleUserModel>;

export const initGuardRoleUser = (
  params: GuardModelInitParams,
  models: {
    GuardRole: GuardRoleModelStatic;
    GuardUser: GuardUserModelStatic;
  },
  userKey: UserKey,
): GuardRoleUserModelStatic => {
  const { sequelize, options } = params;
  const { GuardRole, GuardUser } = models;

  const modelType = AssociationModelType.RoleUser;

  const tableName = getTableName(modelType, options);

  const userColId = 'user_id';
  const roleColId = 'role_id';

  const schema = getGuardRoleUserSchema({
    roleReference: {
      model: GuardRole,
      key: 'id',
    },
    userReference: { model: userKey.table, key: userKey.column },
    userType: userKey.type,
  });

  // Define RoleUser junction model
  const RoleUser = sequelize.define<RoleUserModel>(
    ModelClassNameMap[modelType],
    schema,
    {
      ...modelOptions(options, tableName),
      charset: GuardUser.options.charset,
      collate: GuardUser.options.collate,
      indexes: guardIndexes(modelType, tableName),
    },
  );

  // Set up Role-User many-to-many association
  GuardRole.belongsToMany(GuardUser, {
    through: { model: RoleUser, unique: false },
    constraints: false,
    as: 'Users',
    foreignKey: roleColId,
    otherKey: userColId,
    targetKey: userKey.attribute,
  });

  GuardUser.belongsToMany(GuardRole, {
    through: { model: RoleUser, unique: false },
    constraints: false,
    as: 'Roles',
    foreignKey: userColId,
    otherKey: roleColId,
    sourceKey: userKey.attribute,
  });

  return RoleUser;
};

export const getGuardRoleUserSchema = (params?: {
  roleReference?: ModelAttributeColumnReferencesOptions;
  userReference?: ModelAttributeColumnReferencesOptions;
  userType?: AbstractDataType;
}) => {
  const { roleReference, userReference, userType } = params || {};

  const schema: ModelAttributes<RoleUserModel> = {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
    },
    role_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: roleReference,
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    user_id: {
      type: userType || DataTypes.INTEGER,
      allowNull: false,
      references: userReference,
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
  };

  return schema;
};
