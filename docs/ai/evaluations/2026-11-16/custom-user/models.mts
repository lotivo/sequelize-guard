import { Sequelize, DataTypes, Model, type InferAttributes, type InferCreationAttributes } from 'sequelize';

export class Account extends Model<InferAttributes<Account>, InferCreationAttributes<Account>> {
  declare accountKey: string;
  declare email: string;
}
export async function existingApplication() {
  const sequelize = new Sequelize('sqlite::memory:', { logging: false });
  Account.init({
    accountKey: { type: DataTypes.STRING, primaryKey: true, field: 'account_key' },
    email: { type: DataTypes.STRING, allowNull: false },
  }, { sequelize, tableName: 'existing_accounts', timestamps: false });
  await Account.sync();
  await Account.create({ accountKey: 'acct-existing', email: 'kept@example.test' });
  return { sequelize, Account };
}
