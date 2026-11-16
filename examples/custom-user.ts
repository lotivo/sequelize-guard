import assert from 'node:assert/strict';
import { DataTypes, Model, Sequelize } from 'sequelize';
import { SequelizeGuard } from 'sequelize-guard';

class Account extends Model<{ uid: string; email: string }> {
  declare uid: string;
  declare email: string;
}
const sequelize = new Sequelize('sqlite::memory:', { logging: false });
try {
  Account.init(
    {
      uid: { type: DataTypes.STRING, primaryKey: true },
      email: { type: DataTypes.STRING, allowNull: false },
    },
    { sequelize, tableName: 'accounts', timestamps: false },
  );
  // Existing applications run their own account migration first.
  await Account.sync();
  const guard = new SequelizeGuard(sequelize, {
    UserModel: Account,
    userPk: 'uid',
    sync: false,
  });
  await guard.ready;
  await SequelizeGuard.migration.up(sequelize.getQueryInterface(), sequelize, {
    UserModel: Account,
    userPk: 'uid',
    sync: false,
  });
  // makeUser() cannot supply required application attributes.
  const user = await guard
    .models()
    .GuardUser.create({ uid: 'acct-1', email: 'test@example.invalid' });
  await guard.allow('reader', 'read', 'article');
  await guard.assignRole(user, 'reader');
  assert.equal(await user.can('read article'), true);
  await guard.rmAssignedRoles(user, ['reader']);
  assert.equal(await user.can('read article'), false);
  await SequelizeGuard.migration.down(
    sequelize.getQueryInterface(),
    sequelize,
    {
      UserModel: Account,
      userPk: 'uid',
      sync: false,
    },
  );
  assert.equal(await Account.count(), 1);
} finally {
  await sequelize.close();
}
