import { Sequelize } from 'sequelize';
import { expect, it, onTestFinished, vi } from 'vitest';
import { SequelizeGuard } from '../index';

async function setup() {
  const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: ':memory:',
    logging: false,
  });
  onTestFinished(() => sequelize.close());
  const guard = new SequelizeGuard(sequelize, {
    timestamps: true,
    paranoid: true,
  });
  await guard.ready;
  const user = await guard.makeUser();
  await guard.assignRole(user, 'reader');
  return { sequelize, guard, user };
}

it.each(['name', 'model'] as const)(
  'restores an archived permission junction through the %s role overload once',
  async (overload) => {
    const { guard, user } = await setup();
    const { role } = await guard.allow('reader', 'read', 'article');
    const { RolePermission } = guard.models();
    const original = await RolePermission.findOne({ rejectOnEmpty: true });
    await original.destroy();
    await expect(guard.userCan(user, 'read article')).resolves.toBe(false);
    const added = vi.fn();
    guard.onPermsAddedToRole(added);
    const target = overload === 'model' ? role : 'reader';
    await guard.addPermsToRole(target, 'read', 'article');
    await guard.addPermsToRole(target, 'read', 'article');
    await expect(guard.userCan(user, 'read article')).resolves.toBe(true);
    expect(added).toHaveBeenCalledTimes(1);
    const links = await RolePermission.findAll({ paranoid: false });
    expect(links).toHaveLength(1);
    expect(links[0].id).toBe(original.id);
    expect(links[0].isSoftDeleted()).toBe(false);
  },
);

it('restores an archived residual grant when removing one action from a bundle', async () => {
  const { guard, user } = await setup();
  await guard.allow('reader', 'read', 'article');
  const { RolePermission } = guard.models();
  const residual = await RolePermission.findOne({ rejectOnEmpty: true });
  await residual.destroy();
  await guard.allow('reader', ['read', 'edit'], 'article');
  const result = await guard.rmPermsFromRole('reader', 'edit', 'article');
  expect(result.permsRemoved).toHaveLength(1);
  await expect(guard.userCan(user, 'read article')).resolves.toBe(true);
  await expect(guard.userCan(user, 'edit article')).resolves.toBe(false);
  const links = await RolePermission.findAll({ paranoid: false });
  expect(links).toHaveLength(1);
  expect(links[0].id).toBe(residual.id);
  expect(links[0].isSoftDeleted()).toBe(false);
});

it('restores an archived role membership on reassignment without double-counting active links', async () => {
  const { guard, user } = await setup();
  const { RoleUser } = guard.models();
  const original = await RoleUser.findOne({ rejectOnEmpty: true });
  await original.destroy();
  await expect(guard.getUserRoles(user)).resolves.toEqual([]);

  await guard.assignRoles(user, ['reader', 'reader', 'editor']);
  await guard.assignRole(user, 'reader');

  const roles = await guard.getUserRoles(user);
  expect(roles.map((role) => role.name).sort()).toEqual(['editor', 'reader']);
  const links = await RoleUser.findAll({ paranoid: false });
  expect(links).toHaveLength(2);
  const restored = links.find((link) => link.id === original.id);
  expect(restored?.isSoftDeleted()).toBe(false);
});

it('rolls back restoration and new grants to the operation savepoint and suppresses caller events', async () => {
  const { sequelize, guard, user } = await setup();
  await guard.allow('reader', 'read', 'article');
  const { RolePermission } = guard.models();
  await RolePermission.destroy({ where: {} });
  const added = vi.fn();
  const created = vi.fn();
  guard.onPermsAddedToRole(added);
  guard.onPermsCreated(created);
  const transaction = await sequelize.transaction();
  try {
    RolePermission.addHook('beforeBulkCreate', 'fail-after-restore', () => {
      throw new Error('insertion failed');
    });
    await expect(
      guard.addPermsToRole('reader', 'read', ['article', 'other'], {
        transaction,
      }),
    ).rejects.toThrow('insertion failed');
    RolePermission.removeHook('beforeBulkCreate', 'fail-after-restore');
    expect(await RolePermission.count({ transaction })).toBe(0);
    expect(
      await guard
        .models()
        .GuardPermission.count({ where: { resource: 'other' }, transaction }),
    ).toBe(0);
    await guard.addPermsToRole('reader', 'read', 'article', { transaction });
    expect(await RolePermission.count({ transaction })).toBe(1);
    await transaction.commit();
  } finally {
    RolePermission.removeHook('beforeBulkCreate', 'fail-after-restore');
    if (!('finished' in transaction) || !transaction.finished) {
      await transaction.rollback();
    }
  }
  expect(added).not.toHaveBeenCalled();
  expect(created).not.toHaveBeenCalled();
  await expect(guard.userCan(user, 'read article')).resolves.toBe(true);
});
