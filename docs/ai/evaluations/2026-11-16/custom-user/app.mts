import { SequelizeGuard } from 'sequelize-guard';
import type { Sequelize } from 'sequelize';
import { Account } from './models.mjs';

// Share this exact configuration with the deployment migration runner.
export const guardOptions = {
  UserModel: Account,
  userPk: 'accountKey',
  prefix: 'account_guard_',
  sync: false,
} as const;

// The app owns Account and its schema. Deployment runs migration.up first.
export async function startGuard(sequelize: Sequelize) {
  const guard = new SequelizeGuard(sequelize, guardOptions);
  await guard.ready;
  return guard;
}
