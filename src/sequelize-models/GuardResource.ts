import {
  CreationOptional,
  DataTypes,
  ModelAttributes,
  ModelStatic,
} from 'sequelize';
import { modelOptions } from './utils';
import { GuardModelInitParams, SequelizeModelClass } from './types/types';
import {
  BaseModelType,
  getTableName,
  ModelClassNameMap,
} from './types/ModelType';

/**
 * GuardResource Model - Represents resources in the system (e.g., blog, post, image)
 */
export interface GuardResourceModel
  extends SequelizeModelClass<GuardResourceModel> {
  id: CreationOptional<number>;
  name: string;
  description?: string;
}

export type GuardResourceModelStatic = ModelStatic<GuardResourceModel>;

export const initGuardResource = (
  params: GuardModelInitParams,
): GuardResourceModelStatic => {
  const { sequelize, options } = params;

  const modelType = BaseModelType.Resources;

  const tableName = getTableName(modelType, options);
  const schema = getGuardResourceSchema();

  // Define GuardResource model
  const GuardResource = sequelize.define<GuardResourceModel>(
    ModelClassNameMap[modelType],
    schema,
    modelOptions(options, tableName),
  );

  return GuardResource;
};

export const getGuardResourceSchema = () => {
  const schema: ModelAttributes<GuardResourceModel> = {
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
  };

  return schema;
};
