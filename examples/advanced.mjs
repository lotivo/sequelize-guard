import assert from 'node:assert/strict';
import { DataTypes, Sequelize } from 'sequelize';
import { SequelizeGuard, migration } from 'sequelize-guard';

const sequelize = new Sequelize('sqlite::memory:', { logging: false });
try {
  // Application model migrations run first; Guard owns only its junctions.
  const Team = sequelize.define(
    'Team',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true },
    },
    { timestamps: false },
  );
  const Device = sequelize.define(
    'Device',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true },
    },
    { timestamps: false },
  );
  await Team.sync();
  await Device.sync();
  const options = { sync: false, roleHolders: { team: Team, device: Device } };
  await migration.up(sequelize.getQueryInterface(), sequelize, options);
  const guard = new SequelizeGuard(sequelize, options);
  await guard.ready;
  const team = await Team.create({ id: 1 });
  const device = await Device.create({ id: 1 });
  await guard.allow('reader', 'read', 'article');
  await guard.makeRole('editor');
  await guard.setRoleParent('editor', 'reader');
  assert.deepEqual(await guard.assignRolesToHolder(team, ['editor']), {
    assigned: 1,
  });
  assert.equal(await guard.holderCan(team, 'read article'), true);
  assert.equal(await guard.holderCan(device, 'read article'), false);
  assert.deepEqual(
    (await guard.getHolderRoles(team)).map((role) => role.name),
    ['editor'],
  );
  await assert.rejects(guard.setRoleParent('reader', 'editor')); // Cycle.
  await guard.rmPermsFromRole('reader', 'read', 'article');
  assert.equal(await guard.holderCan(team, 'read article'), false);

  let events = 0;
  const unsubscribe = guard.onPermsAddedToRole(() => {
    events += 1;
  });
  await guard.allow('reader', 'read', 'article');
  assert.equal(events, 1); // Guard-owned operation committed before delivery.
  await sequelize.transaction(async (transaction) => {
    await guard.allow('reader', 'edit', 'article', { transaction });
  });
  assert.equal(events, 1); // Caller transaction suppresses events even on commit.
  assert.equal(await guard.holderCan(team, 'edit article'), true);
  await assert.rejects(
    sequelize.transaction(async (transaction) => {
      await guard.allow('reader', 'delete', 'article', { transaction });
      throw new Error('application rollback');
    }),
    /application rollback/,
  );
  assert.equal(await guard.holderCan(team, 'delete article'), false);
  assert.equal(events, 1);
  unsubscribe();
  await guard.removeRolesFromHolder(team, ['editor']);
  assert.equal(await guard.holderCan(team, 'read article'), false);
  await migration.down(sequelize.getQueryInterface(), sequelize, options);
  assert.equal(await Team.count(), 1);
  assert.equal(await Device.count(), 1);
} finally {
  await sequelize.close();
}
