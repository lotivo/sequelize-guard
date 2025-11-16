import {
  CreationOptional,
  DataTypes,
  ModelAttributes,
  ModelStatic,
} from 'sequelize';
import { GuardModelInitParams, SequelizeModelClass } from './types/types';
import { modelOptions } from './utils';
import {
  BaseModelType,
  getTableName,
  ModelClassNameMap,
} from './types/ModelType';

/**
 * GuardAction Model - Represents actions in the system (e.g., create, read, update, delete)
 */
export interface GuardActionModel
  extends SequelizeModelClass<GuardActionModel> {
  id: CreationOptional<number>;
  name: string;
  description?: string;
}

export type GuardActionModelStatic = ModelStatic<GuardActionModel>;

export const initGuardAction = (
  params: GuardModelInitParams,
): GuardActionModelStatic => {
  const { sequelize, options } = params;

  const modelType = BaseModelType.Actions;

  const tableName = getTableName(modelType, options);
  const schema = getGuardActionSchema();

  // Define GuardAction model
  const GuardAction = sequelize.define<GuardActionModel>(
    ModelClassNameMap[modelType],
    schema,
    modelOptions(options, tableName),
  );

  return GuardAction;
};

export const getGuardActionSchema = () => {
  const schema: ModelAttributes<GuardActionModel> = {
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
