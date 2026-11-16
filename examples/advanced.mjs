import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataTypes, Sequelize } from 'sequelize';
import { SequelizeGuard, migration } from 'sequelize-guard';

const directory = mkdtempSync(join(tmpdir(), 'guard-holders-example-'));
const database = {
  dialect: 'sqlite',
  storage: join(directory, 'policy.sqlite'),
  logging: false,
};
const sequelize = new Sequelize(database);
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
  // Existing deployment: only Team was registered. Use its own connection;
  // constructing another Guard on that instance would violate lifetime ownership.
  const initial = new Sequelize(database);
  try {
    const InitialTeam = initial.define(
      'Team',
      {
        id: { type: DataTypes.INTEGER, primaryKey: true },
      },
      { timestamps: false },
    );
    const initialOptions = { sync: false, roleHolders: { team: InitialTeam } };
    await migration.up(initial.getQueryInterface(), initial, initialOptions);
    const initialGuard = new SequelizeGuard(initial, initialOptions);
    await initialGuard.ready;
    const team = await InitialTeam.create({ id: 1 });
    await initialGuard.allow('reader', 'read', 'article');
    await initialGuard.makeRole('editor');
    await initialGuard.setRoleParent('editor', 'reader');
    await initialGuard.assignRolesToHolder(team, ['editor']);
    assert.equal(await initialGuard.holderCan(team, 'read article'), true);
  } finally {
    await initial.close();
  }

  const query = sequelize.getQueryInterface();
  // Incremental migration accepts ONLY newly added holder types. Existing
  // registrations must not be repeated in this call.
  await assert.rejects(
    migration.addRoleHolders(query, sequelize, {
      sync: false,
      roleHolders: { team: Team },
    }),
    /already exists/,
  );
  await migration.addRoleHolders(query, sequelize, {
    sync: false,
    roleHolders: { device: Device },
  });
  // Application startup and later down/upgrade use the COMPLETE registrations.
  const options = { sync: false, roleHolders: { team: Team, device: Device } };
  const guard = new SequelizeGuard(sequelize, options);
  await guard.ready;
  const team = await Team.findByPk(1, { rejectOnEmpty: true });
  const device = await Device.create({ id: 1 });
  // Existing direct membership, parent chain and inherited grant survived.
  assert.equal(await guard.holderCan(team, 'read article'), true);
  assert.deepEqual(await guard.assignRolesToHolder(team, ['editor']), {
    assigned: 0,
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
  rmSync(directory, { recursive: true, force: true });
}
