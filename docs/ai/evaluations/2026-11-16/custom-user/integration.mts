import assert from 'node:assert/strict';
import { QueryTypes } from 'sequelize';
import { migration } from 'sequelize-guard';
import { existingApplication } from './models.mjs';
import { guardOptions, startGuard } from './app.mjs';

const { sequelize, Account } = await existingApplication();
try {
  const qi = sequelize.getQueryInterface();
  const initialSchema = await qi.describeTable('existing_accounts');
  assert.deepEqual(await qi.showAllTables(), ['existing_accounts']);
  const existing = await Account.findByPk('acct-existing');
  assert.ok(existing);
  assert.equal(existing.email, 'kept@example.test');

  // Deployment fixture: only Guard's tables are provisioned by this migration.
  await migration.up(qi, sequelize, guardOptions);
  assert.deepEqual(await qi.describeTable('existing_accounts'), initialSchema);
  let startupQueries = 0;
  sequelize.addHook('beforeQuery', 'count-startup', () => { startupQueries += 1; });
  const guard = await startGuard(sequelize);
  sequelize.removeHook('beforeQuery', 'count-startup');
  assert.equal(startupQueries, 0, 'sync:false ready must do zero database work');
  assert.equal(guard.models().GuardUser, Account);

  const account = await guard.models().GuardUser.create({
    accountKey: 'acct-new', email: 'new@example.test',
  });
  assert.equal(account.accountKey, 'acct-new');
  assert.equal(account.email, 'new@example.test');
  assert.equal(await account.can('read article'), false);
  assert.equal(await guard.userCan(existing, 'read article'), false);
  await guard.allow('reader', 'read', 'article');
  assert.equal(await account.can('read article'), false, 'a grant alone gives no membership');
  await guard.assignRole(account, 'reader');
  assert.equal(await account.can('read article'), true);
  assert.equal(await guard.userCan(account, 'read article'), true);
  assert.equal(await guard.userCan(existing, 'read article'), false, 'other identities stay denied');
  assert.equal(await account.can('read'), false);
  assert.equal(await account.can('read article extra'), false);
  assert.equal(await account.can('write article'), false);

  const foreignKeys = await sequelize.query<{ table: string; from: string; to: string }>(
    'PRAGMA foreign_key_list("account_guard_role_user")', { type: QueryTypes.SELECT },
  );
  assert.ok(foreignKeys.some(fk => fk.table === 'existing_accounts' && fk.to === 'account_key'));

  await guard.rmPermsFromRole('reader', 'read', 'article');
  assert.equal(await account.can('read article'), false, 'committed action revocation denies');
  await guard.allow('reader', 'read', 'article');
  assert.equal(await account.can('read article'), true);
  await guard.rmAssignedRoles(account, ['reader']);
  assert.equal(await account.can('read article'), false, 'committed membership revocation denies');

  // Disposable fixture rollback, not a production rollback recommendation.
  await migration.down(qi, sequelize, guardOptions);
  assert.deepEqual(await qi.showAllTables(), ['existing_accounts']);
  assert.deepEqual(await qi.describeTable('existing_accounts'), initialSchema);
  assert.deepEqual((await Account.findAll({ order: [['accountKey', 'ASC']] })).map(a => a.get({ plain: true })), [
    { accountKey: 'acct-existing', email: 'kept@example.test' },
    { accountKey: 'acct-new', email: 'new@example.test' },
  ]);
  console.log('PASS: readiness, physical string FK, grant/assign/action+membership revocation, malformed denial, and rollback preserving both accounts');
} finally {
  await sequelize.close();
}
