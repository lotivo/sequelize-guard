import {Model, Sequelize} from 'sequelize';

interface SequelizeGuardOptions {
  prefix?: string;
  primaryKey?: string;
  timestamps?: boolean;
  paranoid?: boolean;
  sync?: boolean;
  debug?: boolean;
  UserModel?: Model;
  userPk?: string;
  safeGuardDeletes?: boolean;
  userCache?: boolean;
  userCacheTtl?: number;
}

interface UserModel {
  assignRole(role: string): UserModel;
}

declare class SequelizeGuard {
  constructor(seql: Sequelize, options: SequelizeGuardOptions);
}

export default SequelizeGuard;

export {
  SequelizeGuardOptions
}
