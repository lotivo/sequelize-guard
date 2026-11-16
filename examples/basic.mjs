import assert from 'node:assert/strict';
import { Sequelize } from 'sequelize';
import { SequelizeGuard } from 'sequelize-guard';

// Automatic initialization is convenient for a new disposable database.
const sequelize = new Sequelize('sqlite::memory:', { logging: false });
try {
  const guard = new SequelizeGuard(sequelize);
  await guard.ready;
  const user = await guard.makeUser();
  assert.equal(await user.can('read article'), false);
  await guard.allow('reader', ['read', 'edit'], 'article');
  await guard.assignRole(user, 'reader');
  assert.equal(await user.can('read article'), true);
  await guard.rmPermsFromRole('reader', 'edit', 'article');
  assert.equal(await user.can('edit article'), false);
  assert.equal(await user.can('read article'), true);
  await guard.rmAssignedRoles(user, ['reader']);
  assert.equal(await user.can('read article'), false);
  assert.equal(await user.can('read article extra'), false);
} finally {
  await sequelize.close();
}
