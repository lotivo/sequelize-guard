import { migration } from 'sequelize-guard';

// Deployment runner executes this before workers start. Account remains app-owned.
export const guardOptions = (Account) => ({
  UserModel: Account, userPk: 'id', prefix: 'app_guard_', sync: false,
});
export async function migrateGuard(sequelize, Account) {
  await migration.up(sequelize.getQueryInterface(), sequelize, guardOptions(Account));
}
