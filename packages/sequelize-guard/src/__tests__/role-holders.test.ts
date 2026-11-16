import { DataTypes, Sequelize } from 'sequelize';
import { expect, expectTypeOf, it, onTestFinished, vi } from 'vitest';
import { defaultOptions } from '../constants';
import { migration, SequelizeGuard } from '../index';
import type { GuardOptions, RoleAssignmentResult } from '../index';
import { roleHolderTables } from '../sequelize-models/guard-role-holders';
import { cleanupDbFile, generateDbPath } from './utils/db-utils';

function database() {
  const storage = generateDbPath('role_holders');
  const connections: Sequelize[] = [];
  onTestFinished(async () => {
    await Promise.all(connections.map((connection) => connection.close()));
    cleanupDbFile(storage);
  });
  return () => {
    const sequelize = new Sequelize({
      dialect: 'sqlite',
      storage,
      logging: false,
    });
    connections.push(sequelize);
    return sequelize;
  };
}

function holders(sequelize: Sequelize) {
  return {
    device: sequelize.define(
      'Device',
      {
        key: { type: DataTypes.INTEGER, primaryKey: true, field: 'device_key' },
      },
      {
        tableName: 'devices',
        paranoid: true,
        deletedAt: 'removedOn',
        underscored: true,
      },
    ),
    agent: sequelize.define(
      'Agent',
      {
        key: { type: DataTypes.INTEGER, primaryKey: true, field: 'agent_key' },
      },
      { tableName: 'agents' },
    ),
    room: sequelize.define(
      'Room',
      {
        code: {
          type: DataTypes.STRING(30),
          primaryKey: true,
          field: 'room_code',
        },
      },
      { tableName: 'rooms' },
    ),
    queue: sequelize.define(
      'Queue',
      {
        uid: { type: DataTypes.UUID, primaryKey: true, field: 'queue_id' },
      },
      { tableName: 'queues' },
    ),
  } satisfies NonNullable<GuardOptions['roleHolders']>;
}

async function setup() {
  const connect = database();
  const sequelize = connect();
  const roleHolders = holders(sequelize);
  await Promise.all(Object.values(roleHolders).map((model) => model.sync()));
  const options = {
    sync: false,
    timestamps: true,
    paranoid: true,
    roleHolders,
  };
  await migration.up(sequelize.getQueryInterface(), sequelize, options);
  const guard = new SequelizeGuard(sequelize, options);
  return { connect, sequelize, guard, roleHolders, options };
}

it('isolates two registered model types with equal IDs from each other and users', async () => {
  const { guard, roleHolders } = await setup();
  const user = await guard.makeUser();
  const device = await roleHolders.device.create({ key: user.id });
  const agent = await roleHolders.agent.create({ key: user.id });
  const { role } = await guard.makeRole('staff');
  await guard.makeRole({ name: 'technician', parent_id: role.id });
  await guard.allow('staff', 'edit', 'article');
  const assignment = guard.assignRolesToHolder(device, [
    'technician',
    ' TECHNICIAN ',
  ]);
  expectTypeOf(assignment).toEqualTypeOf<Promise<RoleAssignmentResult>>();
  await expect(assignment).resolves.toEqual({ assigned: 1 });
  await expect(guard.holderCan(device, 'edit article')).resolves.toBe(true);
  await expect(guard.holderCan(agent, 'edit article')).resolves.toBe(false);
  await expect(guard.userCan(user, 'edit article')).resolves.toBe(false);
  await expect(guard.holderCan(user, 'edit article')).rejects.toThrow(
    'registered role holder',
  );
  await expect(guard.userCan(device, 'edit article')).rejects.toThrow(
    'guard user model',
  );
  expect((await guard.getHolderRoles(device)).map(({ name }) => name)).toEqual([
    'technician',
  ]);
  expect(Reflect.has(roleHolders.device.prototype, 'can')).toBe(false);

  await guard.removeRolesFromHolder(device, ['technician']);
  await expect(guard.holderCan(device, 'edit article')).resolves.toBe(false);
});

it('supports custom string and UUID keys and prevents type remapping from reusing grants', async () => {
  const { guard, connect, roleHolders, options } = await setup();
  const room = await roleHolders.room.create({ code: "r' ? $3" });
  const queue = await roleHolders.queue.create({
    uid: 'fc8ebd2d-fc10-4b85-ae8b-c1c6e17f24ab',
  });
  await guard.allow('ops', 'open', 'room');
  await guard.assignRolesToHolder(room, ['ops']);
  await guard.assignRolesToHolder(queue, ['ops']);
  await expect(guard.holderCan(room, 'open room')).resolves.toBe(true);
  await expect(guard.holderCan(queue, 'open room')).resolves.toBe(true);

  const device = await roleHolders.device.create({ key: 35 });
  await guard.assignRolesToHolder(device, ['ops']);
  const connection = connect();
  const remapped = holders(connection);
  const replacement = await remapped.agent.create({ key: 35 });
  const mismatched = new SequelizeGuard(connection, {
    ...options,
    roleHolders: { device: remapped.agent },
  });
  await expect(
    mismatched.holderCan(replacement, 'open room'),
  ).rejects.toThrow();
  await expect(mismatched.sync()).rejects.toThrow('ownership receipt');
  await expect(guard.holderCan(device, 'open room')).resolves.toBe(true);
});

it('denies soft-deleted holders and prevents hard-deleted keys from reusing memberships', async () => {
  const { connect, guard, roleHolders, options } = await setup();
  const connection = connect();
  const siblingHolders = holders(connection);
  const other = new SequelizeGuard(connection, {
    ...options,
    roleHolders: siblingHolders,
  });
  const device = await roleHolders.device.create({ key: 7 });
  await guard.allow('operator', 'start', 'jobs');
  await guard.assignRolesToHolder(device, ['operator']);
  expect(await guard.holderCan(device, 'start jobs')).toBe(true);

  const sibling = await siblingHolders.device.findByPk(7, {
    rejectOnEmpty: true,
  });
  await expect(other.holderCan(sibling, 'start jobs')).resolves.toBe(true);
  await sibling.destroy();
  await expect(guard.holderCan(device, 'start jobs')).resolves.toBe(false);
  await expect(guard.getHolderRoles(device)).resolves.toEqual([]);
  await expect(guard.assignRolesToHolder(device, ['operator'])).rejects.toThrow(
    'no longer exists',
  );
  await sibling.destroy({ force: true });
  const replacement = await roleHolders.device.create({ key: 7 });
  await expect(guard.holderCan(replacement, 'start jobs')).resolves.toBe(false);
});

it('checks registered memberships before deletion and cleans soft-deleted role links', async () => {
  const { guard, roleHolders } = await setup();
  const device = await roleHolders.device.create({ key: 7 });
  await guard.assignRolesToHolder(device, ['operator']);
  await expect(guard.deleteRoles('operator')).rejects.toThrow('memberships');
  guard.options.safeGuardDeletes = false;
  await expect(guard.deleteRoles('operator')).resolves.toBe(1);
  await expect(guard.getHolderRoles(device)).resolves.toEqual([]);
  const links = guard._roleHolders.get(roleHolders.device)?.links;
  expect(links).toBeDefined();
  await expect(links?.count({ paranoid: false })).resolves.toBe(0);
});

it('adds holder tables without rewriting user memberships and preserves both on upgrade', async () => {
  const connect = database();
  const sequelize = connect();
  const roleHolders = holders(sequelize);
  const { device } = roleHolders;
  await device.sync();
  await roleHolders.agent.sync();
  const query = sequelize.getQueryInterface();
  const base = { sync: false, prefix: 'app_' };
  const source = { ...base, roleHolders: { device } };
  await migration.up(query, sequelize, base);
  const role = { role_id: 1 };
  await query.bulkInsert('app_users', [{ id: 1 }]);
  await query.bulkInsert('app_roles', [{ id: 1, name: 'operator' }]);
  await query.bulkInsert('app_permissions', [
    { id: 1, name: 'start jobs', action: '["start"]', resource: 'jobs' },
  ]);
  await query.bulkInsert('app_role_permission', [
    { ...role, permission_id: 1 },
  ]);
  await query.bulkInsert('app_role_user', [{ ...role, user_id: 1 }]);
  await migration.addRoleHolders(query, sequelize, source);
  await expect(
    migration.addRoleHolders(query, sequelize, source),
  ).rejects.toThrow('already exists');

  const guard = new SequelizeGuard(sequelize, source);
  const user = await guard
    .models()
    .GuardUser.findByPk(1, { rejectOnEmpty: true });
  const holder = await device.create({ key: 1 });
  await expect(guard.userCan(user, 'start jobs')).resolves.toBe(true);
  await guard.assignRolesToHolder(holder, ['operator']);
  await expect(guard.holderCan(holder, 'start jobs')).resolves.toBe(true);
  await expect(migration.down(query, sequelize, base)).rejects.toThrow(
    'ownership receipt',
  );
  await expect(guard.userCan(user, 'start jobs')).resolves.toBe(true);

  const to = {
    ...source,
    prefix: 'target_',
    roleHolders: { ...source.roleHolders, agent: roleHolders.agent },
  };
  await migration.upgrade(query, sequelize, { from: source, to });
  const connection = connect();
  const rebound = holders(connection);
  const target = new SequelizeGuard(connection, {
    ...to,
    roleHolders: { device: rebound.device, agent: rebound.agent },
  });
  const targetUser = await target
    .models()
    .GuardUser.findByPk(1, { rejectOnEmpty: true });
  const copied = await rebound.device.findByPk(1, { rejectOnEmpty: true });
  await expect(target.userCan(targetUser, 'start jobs')).resolves.toBe(true);
  await expect(target.holderCan(copied, 'start jobs')).resolves.toBe(true);
  const agent = await rebound.agent.create({ key: 1 });
  await expect(target.holderCan(agent, 'start jobs')).resolves.toBe(false);
  await migration.down(query, sequelize, to);
  await expect(guard.holderCan(holder, 'start jobs')).resolves.toBe(true);
  await expect(device.count()).resolves.toBe(1);
});

it('keeps registered application models outside guard sync and validates registrations without DB work', async () => {
  const connect = database();
  const sequelize = connect();
  const roleHolders = holders(sequelize);
  const query = vi.spyOn(sequelize, 'query');
  expect(
    () =>
      new SequelizeGuard(sequelize, {
        roleHolders: { 'Invalid Type': roleHolders.device },
      }),
  ).toThrow('Invalid registered role holder type');
  expect(
    () =>
      new SequelizeGuard(sequelize, {
        roleHolders: { device: holders(connect()).device },
      }),
  ).toThrow('registered model of this Sequelize instance');
  expect(
    () =>
      new SequelizeGuard(sequelize, {
        roleHolders: {
          device: roleHolders.device,
          duplicate: roleHolders.device,
        },
      }),
  ).toThrow('distinct names');
  expect(
    () =>
      new SequelizeGuard(sequelize, {
        roleHolders: { device: roleHolders.device },
        tables: { roles: 'devices' },
        prefix: '',
      }),
  ).toThrow('distinct names');
  expect(query).not.toHaveBeenCalled();

  const options = { sync: false, roleHolders: { device: roleHolders.device } };
  const guard = new SequelizeGuard(sequelize, options);
  await guard.ready;
  expect(query).not.toHaveBeenCalled();
  await expect(guard.sync()).rejects.toThrow(
    'Create the registered role holder table',
  );
  await roleHolders.device.sync();
  await roleHolders.device.create({ key: 1 });
  await guard.sync();
  await guard.sync({ force: true });
  await expect(roleHolders.device.count()).resolves.toBe(1);
});

it('rejects SQLite integers that cannot be represented as distinct JavaScript identities', async () => {
  const { guard, sequelize, roleHolders } = await setup();
  await sequelize.getQueryInterface().bulkInsert('agents', [
    {
      agent_key: '9007199254740993',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);
  const holder = await roleHolders.agent.findOne({ rejectOnEmpty: true });
  await expect(guard.assignRolesToHolder(holder, ['operator'])).rejects.toThrow(
    'safe integer primary key',
  );
  await expect(guard.holderCan(holder, 'start jobs')).rejects.toThrow(
    'safe integer primary key',
  );
});

it('preflights an already registered model targeting a holder junction under another name', () => {
  const sequelize = database()();
  const { device } = holders(sequelize);
  const options = { ...defaultOptions, sync: false, roleHolders: { device } };
  const [{ tableName }] = roleHolderTables(sequelize, options);
  sequelize.define('ApplicationJunction', {}, { tableName });
  expect(() => new SequelizeGuard(sequelize, options)).toThrow(
    'conflicts with a registered application table',
  );
  expect(sequelize.models.ApplicationJunction).toBeDefined();
  expect(sequelize.models.GuardRole).toBeUndefined();
});

it('restores archived holder memberships atomically and counts only inactive links', async () => {
  const { guard, sequelize, roleHolders } = await setup();
  const holder = await roleHolders.device.create({ key: 7 });
  await guard.allow('reader', 'read', 'article');
  await guard.assignRolesToHolder(holder, ['reader', 'active']);
  const registration = guard._roleHolders.get(roleHolders.device);
  if (!registration) throw new Error('Missing holder registration');
  const { links } = registration;
  const reader = await guard.getRole('reader');
  if (!reader) throw new Error('Missing reader role');
  const archived = await links.findOne({
    where: { role_id: reader.id },
    rejectOnEmpty: true,
  });
  await archived.destroy();
  const transaction = await sequelize.transaction();
  const created = vi.fn();
  guard.onRolesCreated(created);
  try {
    links.addHook('beforeBulkCreate', 'failed-holder-restore', () => {
      throw new Error('holder insertion failed');
    });
    await expect(
      guard.assignRolesToHolder(holder, ['reader', 'new'], { transaction }),
    ).rejects.toThrow('holder insertion failed');
    links.removeHook('beforeBulkCreate', 'failed-holder-restore');
    expect(await links.count({ transaction })).toBe(1);
    expect(
      await guard
        .models()
        .GuardRole.count({ where: { name: 'new' }, transaction }),
    ).toBe(0);
    await expect(
      guard.assignRolesToHolder(holder, ['reader', 'active'], { transaction }),
    ).resolves.toEqual({ assigned: 1 });
    await expect(
      guard.assignRolesToHolder(holder, ['reader', 'active'], { transaction }),
    ).resolves.toEqual({ assigned: 0 });
    await transaction.rollback();
  } finally {
    links.removeHook('beforeBulkCreate', 'failed-holder-restore');
    if (!('finished' in transaction) || !transaction.finished)
      await transaction.rollback();
  }
  expect(created).not.toHaveBeenCalled();
  await expect(guard.holderCan(holder, 'read article')).resolves.toBe(false);
  await expect(
    guard.assignRolesToHolder(holder, ['reader', 'active']),
  ).resolves.toEqual({ assigned: 1 });
  expect(await links.count({ paranoid: false })).toBe(2);
  const restored = await links.findByPk(archived.id, { rejectOnEmpty: true });
  expect(restored.isSoftDeleted()).toBe(false);
  await expect(guard.holderCan(holder, 'read article')).resolves.toBe(true);
});
