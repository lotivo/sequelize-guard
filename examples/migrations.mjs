import assert from 'node:assert/strict';
import { Sequelize } from 'sequelize';
import { SequelizeGuard, migration } from 'sequelize-guard';

const sequelize = new Sequelize('sqlite::memory:', { logging: false });
const options = { prefix: 'app_guard_', sync: false };
try {
  // Deployment migration: run once before starting application workers.
  await migration.up(sequelize.getQueryInterface(), sequelize, options);
  // Application startup: no sync/alter/force on an existing database.
  const guard = new SequelizeGuard(sequelize, options);
  await guard.ready;
  await guard.allow('reader', 'read', 'article');
  const user = await guard.makeUser();
  await guard.assignRole(user, 'reader');
  assert.equal(await user.can('read article'), true);
  await migration.down(sequelize.getQueryInterface(), sequelize, options);
} finally {
  await sequelize.close();
}
