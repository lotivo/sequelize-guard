import assert from 'node:assert/strict';
import test from 'node:test';
import { existingApplication } from './app.mjs';

test('authorization observes committed policy changes and propagates database failures', async () => {
  const { sequelize, guard, user, authorize } = await existingApplication();
  let closed = false;
  try {
    assert.equal(await authorize(), true, 'warm the existing authorization path');
    assert.equal(await authorize(), true, 'repeat the warmed allowance');

    await sequelize.transaction(async (transaction) => {
      await guard.rmPermsFromRole('reader', 'read', 'document', { transaction });
    });
    assert.equal(await authorize(), false, 'an awaited committed action revocation denies');

    await guard.allow('reader', 'read', 'document');
    assert.equal(await authorize(), true, 'regrant restores authorization');
    assert.equal(await authorize('read document extra'), false, 'malformed checks deny even when access is granted');

    await sequelize.transaction(async (transaction) => {
      await guard.rmAssignedRoles(user, ['reader'], { transaction });
    });
    assert.equal(await authorize(), false, 'an awaited committed membership revocation denies');

    await guard.assignRole(user, 'reader');
    assert.equal(await authorize(), true, 'warm allowance again before losing the database');
    // The application returns its connection; its caller owns shutdown.
    await sequelize.close();
    closed = true;
    await assert.rejects(authorize(), /closed|connection/i, 'database failure must reject instead of reusing allowance');
  } finally {
    if (!closed) await sequelize.close();
  }
});
