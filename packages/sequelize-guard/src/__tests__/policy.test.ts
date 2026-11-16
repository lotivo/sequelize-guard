import { Sequelize } from 'sequelize';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SequelizeGuard } from '../index';
import { closeTestDatabase, createTestDatabase, TestContext } from './setup';

describe('Policy mutations', () => {
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

  function connectOther() {
    otherConnection = new Sequelize({
      dialect: 'sqlite',
      storage: context.dbPath,
      logging: false,
    });
    return new SequelizeGuard(otherConnection, {
      sync: false,
      timestamps: true,
    });
  }

  it('revokes part of a shared action set from exactly one role', async () => {
    const { guard } = context;
    const original = await guard.allow('reader', ['read', 'edit'], 'document');
    expect(original.role.Permissions).toEqual(original.permissions);
    const shared = await guard.allow(
      'other',
      ['edit', 'read', 'edit'],
      'document',
    );
    expect(shared.permissions[0].id).toBe(original.permissions[0].id);
    const reader = await guard.makeUser();
    const other = await guard.makeUser();
    await reader.assignRole('Reader');
    await other.assignRole('other');

    const result = await guard.rmPermsFromRole(
      ' READER ',
      ['edit', 'edit'],
      'document',
    );
    expect(result.permsRemoved.map((permission) => permission.id)).toEqual([
      original.permissions[0].id,
    ]);
    expect(result.permissions.map((permission) => permission.action)).toEqual([
      '["read"]',
    ]);
    expect(await reader.can('read document')).toBe(true);
    expect(await reader.can('edit document')).toBe(false);
    expect(await other.can('edit document')).toBe(true);
    expect(
      (await guard.rmPermsFromRole('reader', 'edit', 'document')).permsRemoved,
    ).toEqual([]);
  });

  it('removes wildcard tokens explicitly and does not carve exclusions out of wildcard grants', async () => {
    const { guard } = context;
    await guard.allow('reader', ['*', 'read'], 'document');
    await guard.allow('reader', 'edit', '*');
    const reader = await guard.makeUser();
    await reader.assignRole('reader');

    expect(
      (await guard.rmPermsFromRole('reader', 'edit', 'document')).permsRemoved,
    ).toEqual([]);
    expect(await reader.can('edit document')).toBe(true);
    expect(
      (await guard.rmPermsFromRole('reader', '*', 'document')).permsRemoved,
    ).toHaveLength(1);
    expect(await reader.can('read document')).toBe(true);
    expect(await reader.can('write document')).toBe(false);
    expect(
      (await guard.rmPermsFromRole('reader', 'edit', '*')).permsRemoved,
    ).toHaveLength(1);
    expect(await reader.can('edit document')).toBe(false);
  });

  it('uses the same validated token grammar in creation and authorization', async () => {
    const { guard } = context;
    await guard.allow('reader', 'réviser', 'Dossier[archive]');
    const reader = await guard.makeUser();
    await reader.assignRole('reader');

    expect(await reader.can('  réviser\t Dossier[archive]  ')).toBe(true);
    expect(await reader.can('réviser dossier[archive]')).toBe(false);
    expect(await reader.can('réviser Dossier[archive] something-else')).toBe(
      false,
    );
    expect(await reader.can('réviser')).toBe(false);
    expect(await reader.can('')).toBe(false);

    await expect(guard.createPerms('document', [''])).rejects.toThrow(
      TypeError,
    );
    await expect(guard.createPerms('document', [])).rejects.toThrow(TypeError);
    await expect(guard.createPerms([], 'read')).rejects.toThrow(TypeError);
    await expect(guard.createPerms('document', ' read ')).rejects.toThrow(
      TypeError,
    );
    await expect(guard.createPerms('doc*', 'read')).rejects.toThrow(TypeError);
    await expect(
      guard.createPermsBulk([
        { resource: 'otherwise-valid', actions: 'read' },
        { resource: 'two tokens', actions: 'read' },
      ]),
    ).rejects.toThrow(TypeError);
    expect(await guard.findPerms({ resource: 'otherwise-valid' })).toEqual([]);
  });

  it('resolves permission data without broadening literal or malformed grants', () => {
    const { guard } = context;
    const grants = [
      { action: '["*",0]', resource: '*' },
      { action: '["*"]', resource: 'white space' },
      { action: '["inspect"]', resource: 'Asset' },
    ];

    expect(guard.resolvePermission(grants, 'inspect Asset')).toBe(true);
    expect(guard.resolvePermission(grants, 'inspect asset')).toBe(false);
    expect(guard.resolvePermission(grants, 'inspect other')).toBe(false);
    expect(guard.resolvePermission(grants, 'inspect Asset extra')).toBe(false);
    expect(guard.resolvePermission([], 'inspect Asset')).toBe(false);
    expect(
      guard.resolvePermission([{ action: '["*"]', resource: '*' }], '*'),
    ).toBe(true);
  });

  it.each([
    '"read"',
    '["read",7]',
    '[null]',
    '["read other"]',
    '["read","r*"]',
    '[',
    '[]',
  ])('ignores a persisted grant with malformed actions %s', async (action) => {
    const { guard } = context;
    const { permissions } = await guard.allow('reader', 'read', 'document');
    const reader = await guard.makeUser();
    await reader.assignRole('reader');
    const [permission] = permissions;
    await permission.update({ action });

    expect(await reader.can('read document')).toBe(false);
  });

  it('ignores the deprecated allow column', async () => {
    const { guard } = context;
    const { permissions } = await guard.allow('reader', 'read', 'document');
    const reader = await guard.makeUser();
    await reader.assignRole('reader');
    await permissions[0].update({ allow: 0 });
    expect(await reader.can('read document')).toBe(true);
  });

  it('reuses legacy generated names and rejects incompatible explicit names atomically', async () => {
    const { guard } = context;
    const legacy = await guard.models().GuardPermission.create({
      name: 'document:[read,edit]',
      resource: 'document',
      action: '["read","edit"]',
    });
    const equivalent = await guard.createPerms(
      'document',
      ['edit', 'read', 'read'],
      { all: true },
    );
    expect(equivalent.map((permission) => permission.id)).toEqual([legacy.id]);
    const [named] = await guard.createPerms('document', 'read', {
      name: ' review ',
    });
    const [repeated] = await guard.createPermsBulk(
      [{ resource: 'document', actions: ['read', 'read'], name: 'review' }],
      { all: true },
    );
    expect(repeated.id).toBe(named.id);
    await expect(
      guard.createPermsBulk([
        { resource: 'new', actions: 'write' },
        { resource: 'document', actions: 'write', name: 'review' },
      ]),
    ).rejects.toThrow(/review/);
    expect(await guard.findPerms({ resource: 'new' })).toEqual([]);
    await expect(
      guard.createPermsBulk([
        { resource: 'one', actions: 'read', name: 'same-name' },
        { resource: 'two', actions: 'read', name: 'same-name' },
      ]),
    ).rejects.toThrow(/same-name/);
    expect(await guard.findPerms({ name: 'same-name' })).toEqual([]);
  });

  it('distinguishes literal action punctuation from action separators', async () => {
    const { guard } = context;
    const [literal] = await guard.createPerms('document', 'read,edit');
    const [twoActions] = await guard.createPerms('document', ['read', 'edit']);
    expect(literal.id).not.toBe(twoActions.id);
    expect(literal.name).not.toBe(twoActions.name);
  });

  it('supports long action sets without truncating generated identities', async () => {
    const { guard } = context;
    const actions = Array.from(
      { length: 100 },
      (_, index) => `action-${index}`,
    );
    const [created] = await guard.createPerms('document', actions);
    const [reused] = await guard.createPerms(
      'document',
      [...actions].reverse(),
      { all: true },
    );

    expect(created.action).toBe(JSON.stringify([...actions].sort()));
    expect(created.name).toMatch(/^permission-sha256:[a-f0-9]{64}$/);
    expect(reused.id).toBe(created.id);
  });

  it('uses fresh writer data for administrative reads and writes', async () => {
    const { guard } = context;
    const other = connectOther();
    await guard.getCache();

    const { role } = await other.makeRole('  READER ');
    expect((await guard.getRole(' Reader '))?.id).toBe(role.id);
    expect(
      (
        await guard.makeRoles(['Reader', 'reader', { name: ' READER ' }], {
          all: true,
        })
      ).map((item) => item.id),
    ).toEqual([role.id]);
    expect(await guard.makeRoles([])).toEqual([]);
    await expect(guard.makeRoles(['valid', '  '])).rejects.toThrow(TypeError);
    expect(await guard.getRole('valid')).toBeNull();

    await role.update({ description: 'changed externally' });
    expect((await guard.allRoles())[0].description).toBe('changed externally');
    expect(await other.deleteRoles('reader')).toBe(1);
    expect(await guard.getRole('reader')).toBeNull();
    const recreated = await guard.makeRole('reader');
    expect(recreated.created).toBe(true);
    expect(recreated.role.id).not.toBe(role.id);
  });

  it('blocks associated role deletion by default and explicitly cleans up when disabled', async () => {
    const { guard } = context;
    const { role } = await guard.allow('reader', 'read', 'document');
    const { role: child } = await guard.makeRole({
      name: 'child',
      parent_id: role.id,
    });
    const user = await guard.makeUser();
    await user.assignRole('reader');
    await guard.makeRole('unassociated');
    const onDeleted = vi.fn();
    guard.onRolesDeleted(onDeleted);

    await expect(guard.deleteRoles(['reader', 'unassociated'])).rejects.toThrow(
      /associated/i,
    );
    expect(await guard.getRole('unassociated')).not.toBeNull();
    expect(await user.can('read document')).toBe(true);
    expect(onDeleted).not.toHaveBeenCalled();
    expect(await guard.deleteRoles('unassociated')).toBe(1);

    guard.options.safeGuardDeletes = false;
    expect(await guard.deleteRoles('reader')).toBe(1);
    expect(
      await guard
        .models()
        .RolePermission.count({ where: { role_id: role.id } }),
    ).toBe(0);
    expect(
      await guard.models().RoleUser.count({ where: { role_id: role.id } }),
    ).toBe(0);
    expect((await guard.getRole('child'))?.parent_id).toBeNull();
    expect(await guard.getRole(child.name)).not.toBeNull();
    expect(await guard.findPerms({ resource: 'document' })).toHaveLength(1);
    expect(await user.can('read document')).toBe(false);
  });
  it('unlinks policy from a soft-deleted role without deleting its user or permission', async () => {
    otherConnection = new Sequelize({
      dialect: 'sqlite',
      storage: context.dbPath,
      logging: false,
    });
    const guard = new SequelizeGuard(otherConnection, {
      prefix: 'paranoid_',
      paranoid: true,
      timestamps: true,
      safeGuardDeletes: false,
    });
    await guard.ready;
    const { role } = await guard.allow('reader', 'read', 'document');
    const user = await guard.makeUser();
    await user.assignRole('reader');

    await expect(guard.deleteRoles('reader')).resolves.toBe(1);

    expect(await guard.getRole('reader')).toBeNull();
    expect(
      await guard.models().GuardRole.findByPk(role.id, {
        paranoid: false,
      }),
    ).not.toBeNull();
    expect(await guard.models().RolePermission.count({ paranoid: false })).toBe(
      0,
    );
    expect(await guard.models().RoleUser.count({ paranoid: false })).toBe(0);
    expect(await user.can('read document')).toBe(false);
    expect(await guard.findPerms()).toHaveLength(1);
    expect(await guard.models().GuardUser.count()).toBe(1);
  });

  it('serializes concurrent guard-managed mutations on one in-memory SQLite connection', async () => {
    otherConnection = new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
    });
    const guard = new SequelizeGuard(otherConnection);
    await guard.ready;

    const [reader, , write] = await Promise.all([
      guard.makeUser(),
      guard.allow('reader', 'read', 'document'),
      guard.allow('reader', 'edit', 'document'),
    ]);
    await reader.assignRole('reader');
    expect(write.permissions).toHaveLength(2);
    expect(await reader.can('read document')).toBe(true);
    expect(await reader.can('edit document')).toBe(true);
  });

  it('deduplicates concurrent role creation and serializes overlapping grant and removal operations', async () => {
    const { guard } = context;
    const other = connectOther();

    const roles = await Promise.all([
      guard.makeRole('Reader'),
      other.makeRole('reader'),
    ]);
    expect(roles.map(({ role }) => role.id)).toEqual([
      roles[0].role.id,
      roles[0].role.id,
    ]);
    expect(roles.filter(({ created }) => created)).toHaveLength(1);

    await Promise.all([
      guard.allow('reader', ['read', 'edit'], 'document'),
      other.allow('reader', ['edit', 'read'], 'document'),
    ]);
    const reader = await guard.makeUser();
    await reader.assignRole('reader');
    expect(await guard.models().RolePermission.count()).toBe(1);

    const [edit, read] = await Promise.all([
      guard.rmPermsFromRole('reader', 'edit', 'document'),
      other.rmPermsFromRole('reader', 'read', 'document'),
    ]);
    expect(edit.permsRemoved).toHaveLength(1);
    expect(read.permsRemoved).toHaveLength(1);
    expect(await reader.can('edit document')).toBe(false);
    expect(await reader.can('read document')).toBe(false);
  });

  it('serializes deletion after an in-progress grant and protects the committed link', async () => {
    const { guard } = context;
    const other = connectOther();
    await guard.makeRole('reader');
    const grantStarted = Promise.withResolvers<void>();
    const releaseGrant = Promise.withResolvers<void>();
    guard.models().RolePermission.beforeBulkCreate(async () => {
      grantStarted.resolve();
      await releaseGrant.promise;
    });

    const earlierGrant = guard.allow('reader', 'read', 'document');
    await grantStarted.promise;
    const deletionStarted = Promise.withResolvers<void>();
    const queryInterface = otherConnection!.getQueryInterface();
    const startTransaction =
      queryInterface.startTransaction.bind(queryInterface);
    vi.spyOn(queryInterface, 'startTransaction').mockImplementationOnce(
      (...args) => {
        deletionStarted.resolve();
        return startTransaction(...args);
      },
    );

    const pendingDeletion = expect(other.deleteRoles('reader')).rejects.toThrow(
      /associated/i,
    );
    await deletionStarted.promise;
    releaseGrant.resolve();

    await earlierGrant;
    await pendingDeletion;
    expect((await other.getRole('reader'))?.Permissions).toHaveLength(1);
  });

  it('delivers managed events after commit and only for actual changes', async () => {
    const { guard } = context;
    const other = connectOther();
    const onRole = vi.fn();
    const onPermission = vi.fn();
    const onGrant = vi.fn();
    let observedRole: ReturnType<SequelizeGuard['getRole']> | undefined;
    guard.onPermsAddedToRole(() => {
      observedRole = other.getRole('reader');
    });
    const onRemove = vi.fn();
    guard.onRolesCreated(onRole);
    guard.onPermsCreated(onPermission);
    guard.onPermsAddedToRole(onGrant);
    guard.onPermsRemovedFromRole(onRemove);

    const { role } = await guard.allow('reader', 'read', 'document');
    expect((await observedRole)?.Permissions).toHaveLength(1);
    expect(onRole).toHaveBeenCalledTimes(1);
    expect(onPermission).toHaveBeenCalledTimes(1);
    expect(onGrant).toHaveBeenCalledExactlyOnceWith(role);
    await guard.allow('reader', 'read', 'document');
    await guard.rmPermsFromRole('reader', 'write', 'document');
    expect(onRole).toHaveBeenCalledTimes(1);
    expect(onPermission).toHaveBeenCalledTimes(1);
    expect(onGrant).toHaveBeenCalledTimes(1);
    expect(onRemove).not.toHaveBeenCalled();
  });

  it('leaves no partial policy or events when the managed commit fails', async () => {
    const { guard, sequelize } = context;
    const onRole = vi.fn();
    const onPermission = vi.fn();
    const onGrant = vi.fn();
    guard.onRolesCreated(onRole);
    guard.onPermsCreated(onPermission);
    guard.onPermsAddedToRole(onGrant);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const failure = new Error('test commit failure');
    vi.spyOn(
      sequelize.getQueryInterface(),
      'commitTransaction',
    ).mockRejectedValueOnce(failure);

    await expect(guard.allow('reader', 'read', 'document')).rejects.toThrow(
      failure,
    );
    expect(onRole).not.toHaveBeenCalled();
    expect(onPermission).not.toHaveBeenCalled();
    expect(onGrant).not.toHaveBeenCalled();
    expect(await guard.getRole('reader')).toBeNull();
    expect(await guard.findPerms()).toEqual([]);
    expect(await guard.models().RolePermission.count()).toBe(0);
  });

  it('isolates operations in caller transactions and suppresses events on commit and rollback', async () => {
    const { guard, sequelize } = context;
    const onRole = vi.fn();
    const onPermission = vi.fn();
    const onGrant = vi.fn();
    guard.onRolesCreated(onRole);
    guard.onPermsCreated(onPermission);
    guard.onPermsAddedToRole(onGrant);

    const outerFailure = new Error('rollback outer application transaction');
    await expect(
      sequelize.transaction(async (transaction) => {
        await guard
          .init()
          .allow('rolled-back')
          .to('read')
          .on('document')
          .commit({ transaction });
        expect(await guard.models().GuardRole.count({ transaction })).toBe(1);
        expect(await guard.getRole('rolled-back')).toBeNull();
        throw outerFailure;
      }),
    ).rejects.toThrow(outerFailure);
    expect(await guard.getRole('rolled-back')).toBeNull();
    expect(await guard.findPerms()).toEqual([]);

    const writeFailure = new Error('test junction write failure');
    await sequelize.transaction(async (transaction) => {
      await guard.makeRole('outer-work', { transaction });
      vi.spyOn(
        guard.models().RolePermission,
        'bulkCreate',
      ).mockRejectedValueOnce(writeFailure);
      await expect(
        guard.allow('failed', 'write', 'document', { transaction }),
      ).rejects.toThrow(writeFailure);
      expect(await guard.models().GuardRole.count({ transaction })).toBe(1);
      expect(await guard.models().GuardPermission.count({ transaction })).toBe(
        0,
      );
      await guard.allow('committed', 'read', 'document', { transaction });
    });

    expect((await guard.allRoles()).map(({ name }) => name).sort()).toEqual([
      'committed',
      'outer-work',
    ]);
    expect(await guard.findPerms()).toHaveLength(1);
    expect(await guard.models().RolePermission.count()).toBe(1);
    expect(onRole).not.toHaveBeenCalled();
    expect(onPermission).not.toHaveBeenCalled();
    expect(onGrant).not.toHaveBeenCalled();
  });

  it('rolls back an assignment when writing the membership fails', async () => {
    const { guard } = context;
    const user = await guard.makeUser();
    const failure = new Error('test membership write failure');
    vi.spyOn(guard.models().RoleUser, 'bulkCreate').mockRejectedValueOnce(
      failure,
    );

    await expect(guard.assignRoles(user, ['first', 'second'])).rejects.toThrow(
      failure,
    );
    expect(await guard.allRoles()).toEqual([]);
    expect(await guard.getUserRoles(user)).toEqual([]);
  });
});
