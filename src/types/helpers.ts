import { Sequelize } from 'sequelize';
import { GuardModels } from '../sequelize-models';
import { GuardOptions } from './options';

type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

export type SequelizeWithGuard<
  S extends Sequelize = Sequelize,
  O extends GuardOptions = GuardOptions,
> = S & {
  guard: import('../SequelizeGuard').SequelizeGuard;
  models: Prettify<
    S['models'] & {
      GuardModels: GuardModels;
    } & (O extends { UserModel: infer U }
        ? { User: U }
        : {
            User: GuardModels['GuardUser'];
          })
  >;
};
