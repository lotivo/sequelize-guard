import type {
  Sequelize,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from 'sequelize';
import { GuardInternalOptions } from '../../types';

export type GuardModelInitParams = {
  sequelize: Sequelize;
  options: GuardInternalOptions;
};

export type SequelizeModelClass<ModelType extends Model = Model> = Model<
  InferAttributes<ModelType>,
  InferCreationAttributes<ModelType>
>;
