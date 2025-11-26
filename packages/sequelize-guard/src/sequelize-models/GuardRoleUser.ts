import {
  CreationOptional,
  DataTypes,
  ForeignKey,
  ModelAttributeColumnReferencesOptions,
  ModelAttributes,
  ModelStatic,
} from 'sequelize';
import { GuardRoleModel, GuardRoleModelStatic } from './GuardRole';
import { GuardUserModel, GuardUserModelStatic } from './GuardUser';
import {
  AssociationModelType,
  getTableName,
  ModelClassNameMap,
} from './types/ModelType';
import { GuardModelInitParams, SequelizeModelClass } from './types/types';
import { modelOptions } from './utils';

/**
 * RoleUser Junction Model
 */
export interface RoleUserModel extends SequelizeModelClass<RoleUserModel> {
  id: CreationOptional<number>;
  role_id: ForeignKey<GuardRoleModel['id']>;
  user_id: ForeignKey<GuardUserModel['id']>;
}

export type GuardRoleUserModelStatic = ModelStatic<RoleUserModel>;

export const initGuardRoleUser = (
  params: GuardModelInitParams,
  models: {
    GuardRole: GuardRoleModelStatic;
    GuardUser: GuardUserModelStatic;
  },
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
    userReference: {
      model: GuardUser,
      key: options.userPk,
    },
  });

  // Define RoleUser junction model
  const RoleUser = sequelize.define<RoleUserModel>(
    ModelClassNameMap[modelType],
    schema,
    {
      ...modelOptions(options, tableName),
      indexes: [
        {
          unique: true,
          fields: [roleColId, userColId],
        },
      ],
    },
  );

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

  return RoleUser;
};

export const getGuardRoleUserSchema = (params?: {
  roleReference?: ModelAttributeColumnReferencesOptions;
  userReference?: ModelAttributeColumnReferencesOptions;
}) => {
  const { roleReference, userReference } = params || {};

  const schema: ModelAttributes<RoleUserModel> = {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    role_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: roleReference,
      onDelete: 'cascade',
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: userReference,
      onDelete: 'cascade',
    },
  };

  return schema;
};
