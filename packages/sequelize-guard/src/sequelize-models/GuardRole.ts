import {
  BelongsToManyAddAssociationsMixin,
  BelongsToManyGetAssociationsMixin,
  BelongsToManyRemoveAssociationsMixin,
  CreationOptional,
  DataTypes,
  ForeignKey,
  Model,
  ModelAttributes,
  ModelAttributeColumnReferencesOptions,
  ModelStatic,
  NonAttribute,
} from 'sequelize';
import { guardIndexes } from './guard-indexes';
import { guardTable } from './guard-tables';
import { GuardPermissionModel } from './GuardPermission';
import type { GuardUserMethods } from './GuardUser';
import {
  BaseModelType,
  getTableName,
  ModelClassNameMap,
} from './types/ModelType';
import { GuardModelInitParams, SequelizeModelClass } from './types/types';
import { modelOptions } from './utils';

export type GuardRoleData = {
  id: CreationOptional<number>;
  name: string;
  description?: string | null;
  parent_id?: ForeignKey<GuardRoleModel['id']> | null;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
};

/**
 * GuardPermission Model - Represents permissions (e.g., view blog, edit post)
 */
export interface GuardRoleModel
  extends SequelizeModelClass<GuardRoleModel>,
    GuardRoleData {
  // Associations
  Permissions?: NonAttribute<GuardPermissionModel[]>;
  Users?: NonAttribute<(Model & GuardUserMethods)[]>;
  ChildRoles?: NonAttribute<GuardRoleModel[]>;
  Parent?: NonAttribute<GuardRoleModel | null>;

  getPermissions: BelongsToManyGetAssociationsMixin<GuardPermissionModel>;
  addPermissions: BelongsToManyAddAssociationsMixin<
    GuardPermissionModel,
    number
  >;
  removePermissions: BelongsToManyRemoveAssociationsMixin<
    GuardPermissionModel,
    number
  >;
}

export type GuardRoleModelStatic = ModelStatic<GuardRoleModel>;

export const initGuardRole = (
  params: GuardModelInitParams,
): GuardRoleModelStatic => {
  const { sequelize, options } = params;

  const modelType = BaseModelType.Roles;

  const tableName = getTableName(modelType, options);
  const schema = getGuardRoleSchema({
    model: guardTable(sequelize, options, modelType),
    key: 'id',
  });

  const GuardRole = sequelize.define<GuardRoleModel>(
    ModelClassNameMap[modelType],
    schema,
    {
      ...modelOptions(options, tableName),
      indexes: guardIndexes(modelType, tableName),
    },
  );

  // Set up Role self-associations for hierarchy
  GuardRole.hasMany(GuardRole, {
    as: 'ChildRoles',
    foreignKey: 'parent_id',
    constraints: false,
  });
  GuardRole.belongsTo(GuardRole, {
    foreignKey: 'parent_id',
    as: 'Parent',
    constraints: false,
  });

  return GuardRole;
};

export const getGuardRoleSchema = (
  parentReference?: ModelAttributeColumnReferencesOptions,
) => {
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
      references: parentReference,
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    },
  };

  return schema;
};
