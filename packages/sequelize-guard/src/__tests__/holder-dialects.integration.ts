import { randomBytes } from 'node:crypto';
import { DataTypes, Sequelize, Transaction } from 'sequelize';
import { expect, it, onTestFinished } from 'vitest';
import { migration, SequelizeGuard } from '../index';

const url = process.env.SEQUELIZE_GUARD_TEST_DATABASE_URL;
if (!url)
  throw new Error(
    'Set SEQUELIZE_GUARD_TEST_DATABASE_URL to a disposable PostgreSQL or MySQL database',
  );

it('serializes bulk assignment and hierarchy edits across connections and supports typed holder junctions', async () => {
  const prefix = `f_${randomBytes(4).toString('hex')}_`;
  const connect = () =>
    new Sequelize(url, {
      logging: false,
      define: { underscored: true },
    });
  const sequelize = connect();
  const second = connect();
  onTestFinished(async () => {
    await Promise.all([sequelize.close(), second.close()]);
  });
  const defineRoom = (connection: Sequelize) =>
    connection.define(
      'Room',
      {
        code: {
          type: DataTypes.STRING(40),
          primaryKey: true,
          field: 'room_code',
        },
      },
      { tableName: prefix + 'rooms', paranoid: true },
    );
  const Room = defineRoom(sequelize);
  const OtherRoom = defineRoom(second);
  await Room.sync();
  onTestFinished(() => Room.drop());

  const options = {
    prefix,
    sync: false,
    timestamps: true,
    paranoid: true,
    roleHolders: { room: Room },
  };
  const query = sequelize.getQueryInterface();
  await migration.up(query, sequelize, options);
  onTestFinished(() => migration.down(query, sequelize, options));
  const guard = new SequelizeGuard(sequelize, options);
  const other = new SequelizeGuard(second, {
    ...options,
    roleHolders: { room: OtherRoom },
  });
  const room = await Room.create({ code: "room-'1" });
  const user = await guard.makeUser();
  const twin = await other
    .models()
    .GuardUser.findByPk(user.id, { rejectOnEmpty: true });

  await guard.makeRoles(['parent', 'child', 'third']);
  await guard.allow('parent', 'read', 'article');
  await guard.setRoleParent('child', 'parent');
  const assigned = await Promise.all([
    guard.assignRolesToUsers([user], ['child', 'one']),
    other.assignUserRoles([{ user: twin, roles: ['child', 'two'] }]),
  ]);
  expect(assigned.map(({ assigned }) => assigned).sort()).toEqual([1, 2]);
  expect(await guard.userCan(user, 'read article')).toBe(true);
  expect(await guard.userIsA(user, 'parent')).toBe(false);

  await guard.assignRolesToHolder(room, ['child']);
  const alias = await OtherRoom.findByPk("room-'1", { rejectOnEmpty: true });
  await expect(other.holderCan(alias, 'read article')).resolves.toBe(true);
  await other.rmPermsFromRole('parent', 'read', 'article');
  await expect(guard.holderCan(room, 'read article')).resolves.toBe(false);
  await expect(guard.userCan(user, 'read article')).resolves.toBe(false);

  const edits = await Promise.allSettled([
    guard.setRoleParent('parent', 'third'),
    other.setRoleParent('third', 'child'),
  ]);
  expect(edits.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
  expect(edits).toContainEqual(
    expect.objectContaining({
      status: 'rejected',
      reason: expect.objectContaining({
        message: 'Role parent would create a cycle',
      }),
    }),
  );

  await guard.setRoleParent('parent', null);
  await guard.setRoleParent('third', null);
  const transaction = await second.transaction({
    isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ,
  });
  try {
    await other.models().GuardRole.findAll({ transaction });
    await guard.setRoleParent('parent', 'third');
    const stale = other.setRoleParent('third', 'child', { transaction });
    await expect(stale).rejects.toThrow(
      sequelize.getDialect() === 'postgres' ? /serialize access/ : /cycle/,
    );
  } finally {
    await transaction.rollback();
  }
  await expect(other.setRoleParent('third', 'child')).rejects.toThrow('cycle');

  await guard.allow('parent', 'read', 'article');
  await alias.destroy();
  await expect(guard.holderCan(room, 'read article')).resolves.toBe(false);
  await expect(guard.userCan(user, 'read article')).resolves.toBe(true);
});
