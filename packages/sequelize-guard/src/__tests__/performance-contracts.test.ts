import { Sequelize } from 'sequelize';
import { expect, it, onTestFinished, vi } from 'vitest';
import { SequelizeGuard } from '../index';
import { closeTestDatabase, createTestDatabase } from './setup';

it('projects only relevant grants in one writer query while validating every ancestor', async () => {
  const context = await createTestDatabase();
  onTestFinished(() => closeTestDatabase(context));
  const { guard, sequelize } = context;
  const { GuardRole, GuardPermission, RolePermission } = guard.models();
  const chain = await GuardRole.bulkCreate(
    Array.from({ length: 128 }, (_, index) => ({ name: `ancestor-${index}` })),
  );
  for (let index = 1; index < chain.length; index++) {
    await chain[index].update({ parent_id: chain[index - 1].id });
  }
  // Unrelated permissions must not cross the SQL/JS boundary on every check.
  const permissions = await GuardPermission.bulkCreate(
    Array.from({ length: 2_000 }, (_, index) => ({
      name: `unrelated-${index}`,
      action: '["read"]',
      resource: `unrelated-${index}`,
    })),
  );
  await RolePermission.bulkCreate(
    permissions.map(({ id }) => ({ role_id: chain[0].id, permission_id: id })),
  );
  await guard.allow(chain[0].name, 'read', 'Asset');
  const user = await guard.makeUser();
  await guard.assignRole(user, chain.at(-1)!.name);
  const query = vi.spyOn(sequelize, 'query');
  try {
    await expect(guard.userCan(user, 'read Asset')).resolves.toBe(true);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenLastCalledWith(
      expect.stringContaining('WITH RECURSIVE'),
      expect.objectContaining({ useMaster: true, transaction: null }),
    );
    const rows = await query.mock.results[0].value;
    expect(rows).toHaveLength(chain.length + 1);
    query.mockClear();
    await expect(guard.userCan(user, 'read asset')).resolves.toBe(false);
    expect(query).toHaveBeenCalledTimes(1);
    expect(await query.mock.results[0].value).toHaveLength(chain.length);

    // A malformed role with no matching grant must still invalidate the path.
    await chain[64].update({ name: 'NONCANONICAL' });
    await expect(guard.userCan(user, 'read Asset')).rejects.toThrow(
      'Stored guard role name must be normalized',
    );
  } finally {
    query.mockRestore();
  }
});

it('ignores deeply nested or oversized malformed action JSON without hiding valid grants', async () => {
  const context = await createTestDatabase();
  onTestFinished(() => closeTestDatabase(context));
  const { guard } = context;
  const { permissions } = await guard.allow('reader', 'read', 'Asset');
  const user = await guard.makeUser();
  await guard.assignRole(user, 'reader');
  const malformed = [
    '['.repeat(10_000) + '"*"' + ']'.repeat(10_000),
    JSON.stringify([
      ...Array.from({ length: 10_000 }, (_, i) => `action-${i}`),
      '*',
      null,
    ]),
    '["*",' + ' '.repeat(100_000),
  ];
  for (const action of malformed) {
    await permissions[0].update({ action });
    await expect(guard.userCan(user, 'read Asset')).resolves.toBe(false);
    await expect(guard.userCan(user, 'ungranted Asset')).resolves.toBe(false);
  }
  await guard.allow('reader', 'inspect', 'Asset');
  await expect(guard.userCan(user, 'inspect Asset')).resolves.toBe(true);
  await expect(guard.userCan(user, 'read Asset')).resolves.toBe(false);
});

it('rejects failed writer reads across warmed administrative and principal APIs', async () => {
  const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: ':memory:',
    logging: false,
  });
  onTestFinished(() => sequelize.close());
  const Team = sequelize.define('FailureTeam', {});
  await Team.sync();
  const guard = new SequelizeGuard(sequelize, { roleHolders: { team: Team } });
  await guard.ready;
  const user = await guard.makeUser();
  const team = await Team.create();
  await guard.allow('reader', 'read', 'Asset');
  await guard.assignRole(user, 'reader');
  await guard.assignRolesToHolder(team, ['reader']);
  const reads = [
    () => guard.getRole('reader'),
    () => guard.allRoles(),
    () => guard.findRoles({ names: ['reader'] }),
    () => guard.findPerms(),
    () => guard.getUserRoles(user),
    () => guard.getHolderRoles(team),
    () => guard.holderCan(team, 'read Asset'),
  ];
  for (const read of reads) await read();
  const failure = new Error('writer unavailable');
  const query = vi.spyOn(sequelize, 'query').mockRejectedValue(failure);
  try {
    for (const read of reads) await expect(read()).rejects.toThrow(failure);
  } finally {
    query.mockRestore();
  }
  await expect(guard.holderCan(team, 'read Asset')).resolves.toBe(true);
});

it('rolls back destructive role cleanup when deleting the role fails', async () => {
  const context = await createTestDatabase();
  onTestFinished(() => closeTestDatabase(context));
  const { guard } = context;
  guard.options.safeGuardDeletes = false;
  await guard.allow('parent', 'read', 'Asset');
  await guard.makeRole('child');
  await guard.setRoleParent('child', 'parent');
  const user = await guard.makeUser();
  await guard.assignRoles(user, ['parent', 'child']);
  const before = await guard.getUserRoles(user);
  const deleted = vi.fn();
  guard.onRolesDeleted(deleted);
  const role = guard.models().GuardRole;
  role.beforeBulkDestroy('fail-delete', () => {
    throw new Error('role delete unavailable');
  });
  try {
    await expect(guard.deleteRoles('parent')).rejects.toThrow(
      'role delete unavailable',
    );
  } finally {
    role.removeHook('beforeBulkDestroy', 'fail-delete');
  }
  expect(await guard.getUserRoles(user)).toEqual(before);
  expect((await guard.getRole('child'))!.parent_id).toBe(
    (await guard.getRole('parent'))!.id,
  );
  await expect(guard.userCan(user, 'read Asset')).resolves.toBe(true);
  expect(deleted).not.toHaveBeenCalled();
  await expect(guard.deleteRoles('parent')).resolves.toBe(1);
  await expect(guard.userCan(user, 'read Asset')).resolves.toBe(false);
});

it('rolls back an earlier permission insert when a later bulk insert fails without events', async () => {
  const context = await createTestDatabase();
  onTestFinished(() => closeTestDatabase(context));
  const { guard } = context;
  const permission = guard.models().GuardPermission;
  const created = vi.fn();
  guard.onPermsCreated(created);
  let inserts = 0;
  permission.beforeCreate('fail-second', () => {
    if (++inserts === 2) throw new Error('second permission unavailable');
  });
  const inputs = [
    { resource: 'one', actions: 'read' },
    { resource: 'two', actions: 'read' },
  ];
  try {
    await expect(guard.createPermsBulk(inputs)).rejects.toThrow(
      'second permission unavailable',
    );
  } finally {
    permission.removeHook('beforeCreate', 'fail-second');
  }
  expect(inserts).toBe(2);
  expect(await guard.findPerms()).toEqual([]);
  expect(created).not.toHaveBeenCalled();
  expect(await guard.createPermsBulk(inputs)).toHaveLength(2);
});

it('rejects user persistence failures without fabricating a user or closing the connection', async () => {
  const context = await createTestDatabase();
  onTestFinished(() => closeTestDatabase(context));
  const { guard, sequelize } = context;
  const count = await guard.models().GuardUser.count();
  const failure = new Error('user insert unavailable');
  const query = vi.spyOn(sequelize, 'query').mockRejectedValueOnce(failure);
  try {
    await expect(guard.makeUser()).rejects.toThrow(failure);
  } finally {
    query.mockRestore();
  }
  expect(await guard.models().GuardUser.count()).toBe(count);
  const user = await guard.makeUser();
  expect(user.isNewRecord).toBe(false);
});

it('preserves the graph and inherited access after a failed graph commit and repeated parenting', async () => {
  const context = await createTestDatabase();
  onTestFinished(() => closeTestDatabase(context));
  const { guard, sequelize } = context;
  await guard.allow('parent', 'read', 'Asset');
  await guard.makeRole('child');
  const user = await guard.makeUser();
  await guard.assignRole(user, 'child');
  const child = await guard.setRoleParent('child', 'parent');
  await guard.setRoleParent('child', 'parent');
  expect((await guard.getRole('child'))!.parent_id).toBe(child.parent_id);
  const failure = new Error('graph commit unavailable');
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const commit = vi
    .spyOn(sequelize.getQueryInterface(), 'commitTransaction')
    .mockRejectedValueOnce(failure);
  try {
    await expect(guard.setRoleParent('child', null)).rejects.toThrow(failure);
  } finally {
    commit.mockRestore();
    warning.mockRestore();
  }
  expect((await guard.getRole('child'))!.parent_id).toBe(child.parent_id);
  await expect(guard.userCan(user, 'read Asset')).resolves.toBe(true);
  // Sequelize discards the uncertain commit connection. The contract is rejection
  // and no false success, rather than safe reuse of that failed transaction.
});
