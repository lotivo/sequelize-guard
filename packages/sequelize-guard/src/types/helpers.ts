import type { Model, ModelStatic, Sequelize } from 'sequelize';
import type { GuardModels, GuardUserModel } from '../sequelize-models';
import type { SequelizeGuard } from '../SequelizeGuard';

export type SequelizeWithGuard<TUser extends Model = GuardUserModel> =
  Sequelize & {
    guard: SequelizeGuard<TUser>;
    models: Sequelize['models'] & {
      GuardModels: GuardModels<TUser>;
      User: TUser extends GuardUserModel
        ? GuardModels['GuardUser']
        : ModelStatic<Model>;
    };
  };
