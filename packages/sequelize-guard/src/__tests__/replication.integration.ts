import { randomBytes } from 'node:crypto';
import { QueryTypes, Sequelize, Transaction } from 'sequelize';
import { expect, it, onTestFinished } from 'vitest';
import { SequelizeGuard, migration } from '../index';

function postgresUrl(name: string): URL {
  const value = process.env[name];
  if (!value)
    throw new Error(`Set ${name} to an isolated PostgreSQL test database`);
  const url = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error(`${name} must use PostgreSQL`);
  }
  return url;
}

function connection(url: URL) {
  return {
    host: url.hostname,
    port: Number(url.port || '5432'),
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)),
  };
}

it('reads authorization and revocation targets from the writer despite a stale physical standby', async () => {
  const writerUrl = postgresUrl('SEQUELIZE_GUARD_TEST_DATABASE_URL');
  const standbyUrl = postgresUrl('SEQUELIZE_GUARD_TEST_REPLICA_URL');
  expect(standbyUrl.pathname).toBe(writerUrl.pathname);
  const standby = new Sequelize(standbyUrl.toString(), { logging: false });
  const sequelize = new Sequelize(writerUrl.toString(), {
    logging: false,
    replication: {
      write: connection(writerUrl),
      read: [connection(standbyUrl)],
    },
  });
  onTestFinished(() => sequelize.close());
  onTestFinished(() => standby.close());

  const read = { type: QueryTypes.SELECT } as const;
  const recovery = 'SELECT pg_is_in_recovery() AS recovery';
  expect(await sequelize.query(recovery, read)).toEqual([{ recovery: true }]);
  expect(await sequelize.query(recovery, { ...read, useMaster: true })).toEqual(
    [{ recovery: false }],
  );

  const options = {
    prefix: `guard_replica_${randomBytes(4).toString('hex')}_`,
    sync: false,
  };
  const queryInterface = sequelize.getQueryInterface();
  await migration.up(queryInterface, sequelize, options);
  onTestFinished(() => migration.down(queryInterface, sequelize, options));

  const guard = new SequelizeGuard(sequelize, options);
  const user = await guard.makeUser();
  const { GuardRole, GuardPermission, RolePermission, RoleUser } =
    guard.models();
  const grant = async (name: string, action: string) => {
    const role = await GuardRole.create({ name });
    const permission = await GuardPermission.create({
      name: action + ' article',
      action: JSON.stringify([action]),
      resource: 'article',
    });
    await RolePermission.create({
      role_id: role.id,
      permission_id: permission.id,
    });
    await RoleUser.create({ role_id: role.id, user_id: user.id });
  };
  await grant('mirrored', 'read');
  const replicatedAt = await sequelize.query<{ lsn: string }>(
    'SELECT pg_current_wal_lsn() AS lsn',
    { ...read, useMaster: true },
  );
  await expect
    .poll(
      () =>
        standby.query(
          'SELECT pg_last_wal_replay_lsn() >= $1::pg_lsn AS synced',
          {
            ...read,
            bind: [replicatedAt[0].lsn],
          },
        ),
      { timeout: 10_000 },
    )
    .toEqual([{ synced: true }]);
  expect((await user.getRoles()).map(({ name }) => name)).toEqual(['mirrored']);

  await standby.query('SELECT pg_wal_replay_pause()', read);
  onTestFinished(async () => {
    await standby.query('SELECT pg_wal_replay_resume()', read);
  });
  await expect
    .poll(
      () =>
        standby.query('SELECT pg_get_wal_replay_pause_state() AS state', read),
      { timeout: 10_000 },
    )
    .toEqual([{ state: 'paused' }]);

  await grant('writer-only', 'edit');
  expect((await user.getRoles()).map(({ name }) => name)).toEqual(['mirrored']);
  expect(await guard.userCan(user, 'edit article')).toBe(true);

  const old = await sequelize.transaction({
    isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ,
  });
  try {
    expect(
      await RoleUser.count({ transaction: old, where: { user_id: user.id } }),
    ).toBe(2);
    await guard.rmAssignedRoles(user, ['mirrored', 'writer-only']);
    expect(await guard.userCan(user, 'read article')).toBe(false);
    expect(await guard.userCan(user, 'edit article')).toBe(false);
    expect(await guard.getUserRoles(user)).toEqual([]);
    expect(
      await RoleUser.count({ useMaster: true, where: { user_id: user.id } }),
    ).toBe(0);
    expect((await user.getRoles()).map(({ name }) => name)).toEqual([
      'mirrored',
    ]);
    expect(
      await RoleUser.count({ transaction: old, where: { user_id: user.id } }),
    ).toBe(2);
  } finally {
    await old.rollback();
  }
});
