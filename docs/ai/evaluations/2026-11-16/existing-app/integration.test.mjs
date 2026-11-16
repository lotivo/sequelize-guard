import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Sequelize, DataTypes } from 'sequelize';
import { migration } from 'sequelize-guard';
import { defineAccount, createApplication, bootstrapAdmin } from './app.mjs';
import { migrateGuard, guardOptions } from './migrations.mjs';

// Fixture creates the pre-existing app schema explicitly, before Guard migration.
async function existingDatabase() {
  const sequelize = new Sequelize('sqlite::memory:', { logging: false });
  const Account = defineAccount(sequelize);
  await sequelize.getQueryInterface().createTable('application_accounts', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false },
  });
  const reader = await Account.create({ email: 'reader@example.test' });
  const admin = await Account.create({ email: 'admin@example.test' });
  return { sequelize, Account, reader, admin };
}
async function snapshot(guard) {
  const names = ['GuardRole', 'GuardPermission', 'RolePermission', 'RoleUser'];
  return Promise.all(names.map(name => guard.models()[name].findAll({ raw: true, order: [['id', 'ASC']] })));
}

test('existing account storage, verified sessions and administrative grants', async () => {
  const fixture = await existingDatabase();
  let closed = false;
  try {
    const before = await fixture.Account.findAll({ raw: true });
    await migrateGuard(fixture.sequelize, fixture.Account);
    assert.deepEqual(await fixture.Account.findAll({ raw: true }), before);
    const app = await createApplication(fixture);
    assert.equal(app.guard.models().GuardUser, fixture.Account);
    await bootstrapAdmin(app.guard, app.admin);
    assert.equal(await app.guard.userCan(app.admin, 'manage policy'), true);
    assert.equal(await app.guard.userCan(app.reader, 'manage policy'), false);
    assert.equal(await app.guard.userCan(app.admin, 'read document'), false);
    assert.deepEqual(await app.readDocument({}), { status: 401 });
    assert.deepEqual(await app.readDocument({ id: app.admin.id, headers: { 'x-user-id': app.admin.id } }), { status: 401 });
    assert.deepEqual(await app.readDocument({ session: 'forged', id: app.admin.id }), { status: 401 });
    assert.deepEqual(await app.readDocument({ session: 'reader-session' }), { status: 403 });
    const policyBefore = await snapshot(app.guard);
    assert.deepEqual(await app.grantReader({ session: 'reader-session', id: app.admin.id }), { status: 403 });
    assert.deepEqual(await snapshot(app.guard), policyBefore);
    assert.deepEqual(await app.grantReader({ id: app.admin.id }), { status: 401 });
    assert.deepEqual(await app.grantReader({ session: 'admin-session' }), { status: 200 });
    assert.deepEqual(await app.readDocument({ session: 'reader-session' }), { status: 200, body: 'document' });
    await app.guard.rmPermsFromRole('reader', 'read', 'document');
    assert.deepEqual(await app.readDocument({ session: 'reader-session' }), { status: 403 });
    await app.grantReader({ session: 'admin-session' });
    await app.guard.rmAssignedRoles(app.reader, ['reader']);
    assert.deepEqual(await app.readDocument({ session: 'reader-session' }), { status: 403 });
    assert.equal(await app.guard.userCan(app.reader, 'read document extra'), false);
    assert.deepEqual(await app.Account.findAll({ raw: true }), before);
    await fixture.sequelize.close();
    closed = true;
    assert.deepEqual(await app.readDocument({ session: 'reader-session' }), { status: 503 });
    assert.deepEqual(await app.grantReader({ session: 'admin-session' }), { status: 503 });
  } finally {
    if (!closed) await fixture.sequelize.close();
  }
});

test('Guard migration rollback preserves application accounts', async () => {
  const fixture = await existingDatabase();
  try {
    const before = await fixture.Account.findAll({ raw: true });
    await migrateGuard(fixture.sequelize, fixture.Account);
    await migration.down(fixture.sequelize.getQueryInterface(), fixture.sequelize, guardOptions(fixture.Account));
    assert.deepEqual(await fixture.Account.findAll({ raw: true }), before);
  } finally {
    await fixture.sequelize.close();
  }
});

test('missing deployment schema never permits protected access', async () => {
  const fixture = await existingDatabase();
  try {
    // sync:false ready does no database work. Missing migrations surface at check.
    const app = await createApplication(fixture);
    assert.deepEqual(await app.readDocument({ session: 'reader-session' }), { status: 503 });
    assert.deepEqual(await app.grantReader({ session: 'admin-session' }), { status: 503 });
  } finally {
    await fixture.sequelize.close();
  }
});
