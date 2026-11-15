import { Sequelize } from 'sequelize';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SequelizeGuard } from '../index';
import type { GuardRoleModel } from '../sequelize-models';
import { closeTestDatabase, createTestDatabase, TestContext } from './setup';

describe('Authorization after revocation', () => {
  let context: TestContext;
  let otherConnection: Sequelize | undefined;

  beforeEach(async () => {
    context = await createTestDatabase();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await otherConnection?.close();
    otherConnection = undefined;
    await closeTestDatabase(context);
  });

  it('denies every role and permission check after warmed membership is revoked', async () => {
    const { guard } = context;
    guard.options.userCacheTtl = 0;
    await guard.allow('reader', 'read', 'document');
    const user = await guard.makeUser();
    await user.assignRole!('reader');
    expect(await guard.getUserRoles(user)).toHaveLength(1);
    expect(await user.can!('read document')).toBe(true);
    expect(await user.isA!('reader')).toBe(true);

    await user.rmAssignedRoles!(['reader']);

    expect(await user.getRoles!()).toEqual([]);
    expect(await user.can!('read document')).toBe(false);
    expect(await user.cant!('read document')).toBe(true);
    expect(await user.isA!('reader')).toBe(false);
    expect(await user.isAn!('reader')).toBe(false);
    expect(await user.isAnyOf!(['reader'])).toBe(false);
    expect(await user.isAllOf!(['reader'])).toBe(false);
    expect(await guard.getUserRoles(user)).toEqual([]);
  });

  it('sees single and bulk assignments after a cached empty membership', async () => {
    const { guard } = context;
    const user = await guard.makeUser();
    expect(await guard.getUserRoles(user)).toEqual([]);
    expect(await user.isA!('reader')).toBe(false);
    await user.assignRole!('reader');
    expect(await user.isA!('reader')).toBe(true);
    await user.rmAssignedRoles!(['reader']);
    expect(await guard.getUserRoles(user)).toEqual([]);
    await user.assignRoles!(['reader', 'editor']);
    expect(await user.isAllOf!(['reader', 'editor'])).toBe(true);
    expect(await user.isAllOf!(['reader'])).toBe(true);
    expect(await user.isAllOf!(['reader', 'missing'])).toBe(false);
    expect(await user.isAnyOf!([])).toBe(false);
    expect(await user.isAllOf!([])).toBe(true);
  });

  it('denies a deleted role without throwing on its missing cached permissions', async () => {
    const { guard } = context;
    await guard.allow('reader', 'read', 'document');
    const user = await guard.makeUser();
    await user.assignRole!('reader');
    expect(await user.can!('read document')).toBe(true);
    expect(await user.isA!('reader')).toBe(true);

    expect(await guard.deleteRoles('reader')).toBe(1);

    await expect(user.can!('read document')).resolves.toBe(false);
    expect(await user.isA!('reader')).toBe(false);
  });

  it.each([true, false])(
    'observes revocations through another connection with userCache=%s',
    async (userCache) => {
      const { guard } = context;
      await guard.allow('reader', 'read', 'document');
      await guard.allow('reader', 'list', 'document');
      const user = await guard.makeUser();
      await user.assignRole!('reader');

      otherConnection = new Sequelize({
        dialect: 'sqlite',
        storage: context.dbPath,
        logging: false,
      });
      const other = new SequelizeGuard(otherConnection, {
        sync: false,
        timestamps: true,
        userCache,
        userCacheTtl: 0,
      });
      await other.ready;
      const otherUser = await other
        .models()
        .GuardUser.findByPk(user.id, { rejectOnEmpty: true });
      expect(await otherUser.can!('read document')).toBe(true);
      expect(await otherUser.isA!('reader')).toBe(true);

      const removal = await guard.rmPermsFromRole('reader', 'read', 'document');
      expect(removal.permsRemoved).toHaveLength(1);
      expect(await user.can!('read document')).toBe(false);
      expect(await otherUser.can!('read document')).toBe(false);
      expect(await otherUser.can!('list document')).toBe(true);

      await user.rmAssignedRoles!(['reader']);
      expect(await otherUser.isA!('reader')).toBe(false);
      expect(await otherUser.can!('list document')).toBe(false);
    },
  );

  it('can revoke a role that was created after another guard initialized', async () => {
    const { guard } = context;
    otherConnection = new Sequelize({
      dialect: 'sqlite',
      storage: context.dbPath,
      logging: false,
    });
    const other = new SequelizeGuard(otherConnection, {
      sync: false,
      timestamps: true,
    });
    await other.ready;
    await guard.allow('reader', 'read', 'document');
    const user = await guard.makeUser();
    await user.assignRole!('reader');
    expect(await user.can!('read document')).toBe(true);

    expect(await other.deleteRoles('reader')).toBe(1);
    expect(await user.can!('read document')).toBe(false);
    expect(await user.isA!('reader')).toBe(false);
  });

  it('observes policy and membership writes made directly through Sequelize', async () => {
    const { guard } = context;
    const { role } = await guard.allow('reader', '*', 'document');
    const user = await guard.makeUser();
    await user.assignRole!('reader');
    expect(await user.can!('edit document')).toBe(true);
    expect(await user.isA!('reader')).toBe(true);

    await guard
      .models()
      .RolePermission.destroy({ where: { role_id: role.id } });
    expect(await user.can!('edit document')).toBe(false);
    await guard.models().RoleUser.destroy({ where: { user_id: user.id } });
    expect(await user.isA!('reader')).toBe(false);
  });

  it('does not reuse a membership read that finishes after revocation', async () => {
    const { guard } = context;
    await guard.allow('reader', 'read', 'document');
    const user = await guard.makeUser();
    await user.assignRole!('reader');
    const readStarted = Promise.withResolvers<void>();
    const releaseRead = Promise.withResolvers<void>();
    const getRoles = user.getRoles!.bind(user);
    vi.spyOn(user, 'getRoles').mockImplementationOnce(async () => {
      const roles = await getRoles();
      readStarted.resolve();
      await releaseRead.promise;
      return roles;
    });

    const earlierRead = guard.getUserRoles(user);
    await readStarted.promise;
    try {
      await user.rmAssignedRoles!(['reader']);
      expect(await user.can!('read document')).toBe(false);
    } finally {
      releaseRead.resolve();
      await earlierRead;
    }

    expect(await user.can!('read document')).toBe(false);
    expect(await user.isA!('reader')).toBe(false);
  });

  it('rejects database failures instead of falling back to a warmed permission', async () => {
    const { guard } = context;
    await guard.allow('reader', 'read', 'document');
    const user = await guard.makeUser();
    await user.assignRole!('reader');
    expect(await user.can!('read document')).toBe(true);
    expect(await user.isA!('reader')).toBe(true);
    const error = new Error('authorization database unavailable');
    vi.spyOn(user, 'getRoles').mockRejectedValue(error);

    await expect(user.can!('read document')).rejects.toThrow(error);
    await expect(user.cant!('read document')).rejects.toThrow(error);
    await expect(user.isA!('reader')).rejects.toThrow(error);
  });

  it('does not restore a revoked permission when an older grant finishes later', async () => {
    const { guard } = context;
    await guard.allow('reader', 'read', 'document');
    const user = await guard.makeUser();
    await user.assignRole!('reader');
    expect(await user.can!('read document')).toBe(true);
    const grantStarted = Promise.withResolvers<void>();
    const releaseGrant = Promise.withResolvers<void>();
    const prototype = guard.models().GuardRole.prototype as GuardRoleModel;
    const addPermissions = prototype.addPermissions!;
    vi.spyOn(prototype, 'addPermissions').mockImplementationOnce(
      async function (this: GuardRoleModel, permissions) {
        grantStarted.resolve();
        await releaseGrant.promise;
        return addPermissions.call(this, permissions);
      },
    );

    const earlierGrant = guard.allow('reader', 'edit', 'document');
    await grantStarted.promise;
    try {
      const removal = await guard.rmPermsFromRole('reader', 'read', 'document');
      expect(removal.permsRemoved).toHaveLength(1);
    } finally {
      releaseGrant.resolve();
      await earlierGrant;
    }

    expect(await user.can!('read document')).toBe(false);
    expect(await user.can!('edit document')).toBe(true);
  });

  it('routes authorization reads to the writer to avoid replica lag', async () => {
    const { guard } = context;
    await guard.allow('reader', 'read', 'document');
    const user = await guard.makeUser();
    await user.assignRole!('reader');
    const query = vi.spyOn(guard.models().GuardRole, 'findAll');

    expect(await user.can!('read document')).toBe(true);
    expect(query).toHaveBeenLastCalledWith(
      expect.objectContaining({ useMaster: true }),
    );
    expect(await user.isA!('reader')).toBe(true);
    expect(query).toHaveBeenLastCalledWith(
      expect.objectContaining({ useMaster: true }),
    );
  });

  it('does not silently skip membership revocation because a replica lacks the role', async () => {
    const { guard } = context;
    await guard.allow('reader', 'read', 'document');
    const user = await guard.makeUser();
    await user.assignRole!('reader');
    const model = guard.models().GuardRole;
    const findAll = model.findAll.bind(model);
    vi.spyOn(model, 'findAll').mockImplementation((options) =>
      options?.useMaster ? findAll(options) : Promise.resolve([]),
    );

    await user.rmAssignedRoles!(['reader']);
    expect(await user.isA!('reader')).toBe(false);
    expect(await user.can!('read document')).toBe(false);
  });

  it('reads permission revocation targets from the writer', async () => {
    const { guard } = context;
    await guard.allow('reader', 'read', 'document');
    const user = await guard.makeUser();
    await user.assignRole!('reader');
    const { GuardRole, GuardPermission } = guard.models();
    const findRoles = GuardRole.findAll.bind(GuardRole);
    const findPermissions = GuardPermission.findAll.bind(GuardPermission);
    vi.spyOn(GuardRole, 'findAll').mockImplementation((options) =>
      options?.useMaster ? findRoles(options) : Promise.resolve([]),
    );
    vi.spyOn(GuardPermission, 'findAll').mockImplementation((options) =>
      options?.useMaster ? findPermissions(options) : Promise.resolve([]),
    );

    const removed = await guard.rmPermsFromRole('reader', 'read', 'document');
    expect(removed.permsRemoved).toHaveLength(1);
    expect(await user.can!('read document')).toBe(false);
  });
});
