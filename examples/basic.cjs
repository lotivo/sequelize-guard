const assert = require('node:assert/strict');
const { Sequelize } = require('sequelize');
const { SequelizeGuard } = require('sequelize-guard');

(async () => {
  const sequelize = new Sequelize('sqlite::memory:', { logging: false });
  try {
    const guard = new SequelizeGuard(sequelize, { sync: false });
    await guard.ready; // No database work with sync:false.
    await guard.sync(); // Explicit provisioning for this disposable database.
    const user = await guard.makeUser();
    await guard.init().allow('reader').to('read').on('article').commit();
    await guard.assignRole(user, 'reader');
    assert.equal(await user.can('read article'), true);
    await guard.rmAssignedRoles(user, ['reader']);
    assert.equal(await user.can('read article'), false);
  } finally {
    await sequelize.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
