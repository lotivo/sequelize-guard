import {
  ConnectionError,
  DataTypes,
  ForeignKeyConstraintError,
  Sequelize,
  UniqueConstraintError,
} from 'sequelize';
import previousGuard, {
  migration as previousMigration,
} from 'sequelize-guard-previous';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi,
} from 'vitest';
import { SequelizeGuard, migration } from '../index';
import type { GuardOptions } from '../types';
import { cleanupDbFile, generateDbPath } from './utils/db-utils';
type PreviousOptions = NonNullable<Parameters<typeof previousMigration.up>[2]>;
interface PreviousAccount
  extends InstanceType<NonNullable<PreviousOptions['UserModel']>> {
  display: string;
}

describe('Guard schema migrations on SQLite', () => {
  let sequelize: Sequelize;

  beforeEach(() => {
    sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
    });
  });

  afterEach(async () => {
    await sequelize.close();
  });

  async function useFileStorage() {
    await sequelize.close();
    const storage = generateDbPath('guard_migrations');
    const options = { dialect: 'sqlite', storage, logging: false } as const;
    sequelize = new Sequelize(options);
    onTestFinished(() => cleanupDbFile(storage));
    return options;
  }

  const dateSettings = [
    { timestamps: false, paranoid: false },
    { timestamps: false, paranoid: true },
    { timestamps: true, paranoid: false },
    { timestamps: true, paranoid: true },
  ];
  const settings = [false, true].flatMap((underscored) =>
    dateSettings.map((dates) => ({ ...dates, underscored })),
  );

  it.each(settings)(
    'matches model sync with %j',
    async ({ underscored, ...dates }) => {
      await sequelize.close();
      const dbOptions = {
        dialect: 'sqlite',
        storage: ':memory:',
        logging: false,
        define: { underscored },
      } as const;
      sequelize = new Sequelize(dbOptions);
      const syncSequelize = new Sequelize(dbOptions);
      onTestFinished(() => syncSequelize.close());
      const options = { ...dates, sync: false };
      const queryInterface = sequelize.getQueryInterface();
      const appGuard = new SequelizeGuard(sequelize, options);
      const syncGuard = new SequelizeGuard(syncSequelize, options);

      await migration.up(queryInterface, Sequelize, options);
      await syncGuard.sync();
      for (const name of [
        'permissions',
        'resources',
        'role_permission',
        'role_user',
        'roles',
        'users',
      ]) {
        expect(await queryInterface.describeTable(`guard_${name}`)).toEqual(
          await syncSequelize
            .getQueryInterface()
            .describeTable(`guard_${name}`),
        );
      }

      for (const guard of [appGuard, syncGuard]) {
        const user = await guard.makeUser();
        await guard.allow('writer', ['read'], 'article');
        await guard.assignRole(user, 'writer');
        expect(await guard.userCan(user, 'read article')).toBe(true);
        await guard.rmAssignedRoles(user, ['writer']);
        expect(await guard.userCan(user, 'read article')).toBe(false);
        const role = await guard
          .models()
          .GuardRole.findOne({ rejectOnEmpty: true });
        await role.update({ description: 'updated' });
        await role.destroy();
        const deleted = await guard
          .models()
          .GuardRole.findByPk(role.id, { paranoid: false });
        expect(deleted !== null).toBe(dates.paranoid && dates.timestamps);
      }
    },
  );

  it('uses resolved names for unique indexes, foreign keys and referential actions', async () => {
    const options = {
      prefix: 'auth_',
      tables: {
        roles: 'profiles',
        permissions: 'rules',
        users: 'subjects',
        role_permission: 'profile_rules',
        role_user: 'profile_subjects',
        resources: 'objects',
      },
      sync: false,
    } satisfies GuardOptions;
    const queryInterface = sequelize.getQueryInterface();
    await migration.up(queryInterface, sequelize, options);
    const guard = new SequelizeGuard(sequelize, options);
    const { GuardRole, GuardPermission, RolePermission, RoleUser } =
      guard.models();
    const user = await guard.makeUser();
    const allow = await guard.allow('editor', 'read', 'article');
    const role = await GuardRole.findOne({ rejectOnEmpty: true });
    const permission = await GuardPermission.findOne({ rejectOnEmpty: true });
    await guard.assignRole(user, 'editor');
    expect(allow).toBeDefined();
    await expect(
      RoleUser.create({ role_id: role.id, user_id: user.id }),
    ).rejects.toBeInstanceOf(UniqueConstraintError);
    await expect(
      RoleUser.create({ role_id: role.id, user_id: user.id + 10 }),
    ).rejects.toBeInstanceOf(ForeignKeyConstraintError);
    await expect(
      RolePermission.create({ role_id: role.id, permission_id: permission.id }),
    ).rejects.toBeInstanceOf(UniqueConstraintError);
    await expect(
      RolePermission.create({
        role_id: role.id,
        permission_id: permission.id + 10,
      }),
    ).rejects.toBeInstanceOf(ForeignKeyConstraintError);
    await expect(
      GuardRole.create({ name: 'orphan', parent_id: role.id + 10 }),
    ).rejects.toBeInstanceOf(ForeignKeyConstraintError);

    expect(
      await queryInterface.getForeignKeyReferencesForTable(
        'auth_profile_subjects',
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          referencedTableName: 'auth_profiles',
          referencedColumnName: 'id',
        }),
        expect.objectContaining({
          referencedTableName: 'auth_subjects',
          referencedColumnName: 'id',
        }),
      ]),
    );
    expect(await queryInterface.showIndex('auth_profile_subjects')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'auth_profile_subjects_role_id_user_id',
          unique: true,
        }),
        expect.objectContaining({ name: 'auth_profile_subjects_user_id' }),
      ]),
    );
    const child = await GuardRole.create({ name: 'child', parent_id: role.id });
    await role.destroy();
    expect((await child.reload()).parent_id).toBe(null);
    expect(await RoleUser.count()).toBe(0);
    expect(await RolePermission.count()).toBe(0);
    expect(await guard.userCan(user, 'read article')).toBe(false);
  });

  it.each([
    { type: DataTypes.UUID, key: 'abef094d-7c5e-4e59-b3f1-dc5d83ce654e' },
    { type: DataTypes.STRING(64), key: 'user-A9' },
  ])(
    'supports the supplied key $key, its physical column and required attributes',
    async ({ key, type }) => {
      const UserModel = sequelize.define(
        'Account',
        {
          accountKey: { type, primaryKey: true, field: 'account_key' },
          display: { type: DataTypes.STRING, allowNull: false },
        },
        { tableName: 'app_accounts' },
      );
      await UserModel.sync();
      const options = {
        UserModel,
        userPk: 'account_key',
        tables: { users: 'ignored' },
        sync: false,
      };
      const queryInterface = sequelize.getQueryInterface();
      await migration.up(queryInterface, sequelize, options);
      const guard = new SequelizeGuard(sequelize, options);
      await UserModel.create({ accountKey: key, display: 'Required name' });
      const user = await guard
        .models()
        .GuardUser.findByPk(key, { rejectOnEmpty: true });
      await guard.allow('editor', 'read', 'article');
      await guard.assignRole(user, 'editor');
      expect(await guard.userCan(user, 'read article')).toBe(true);
      expect(
        (await guard.models().RoleUser.findOne({ rejectOnEmpty: true }))
          .user_id,
      ).toBe(key);
      await guard.rmAssignedRoles(user, ['editor']);
      expect(await guard.userCan(user, 'read article')).toBe(false);
      expect(await queryInterface.tableExists('guard_ignored')).toBe(false);

      await migration.down(queryInterface, sequelize, options);
      await migration.down(queryInterface, sequelize, options);
      expect(await queryInterface.showAllTables()).toEqual(['app_accounts']);
      expect((await UserModel.findByPk(key))?.get('display')).toBe(
        'Required name',
      );
    },
  );

  it('rejects invalid user keys and overlapping names before any DDL', async () => {
    const CompositeUser = sequelize.define('Composite', {
      tenant: { type: DataTypes.STRING, primaryKey: true },
      key: { type: DataTypes.STRING, primaryKey: true },
    });
    const UserModel = sequelize.define(
      'Account',
      {
        subject: { type: DataTypes.UUID, primaryKey: true },
      },
      { tableName: 'guard_roles' },
    );
    const queryInterface = sequelize.getQueryInterface();
    expect(
      () => new SequelizeGuard(sequelize, { UserModel: CompositeUser }),
    ).toThrow('one primary key');
    expect(
      () => new SequelizeGuard(sequelize, { UserModel, userPk: 'missing' }),
    ).toThrow('userPk');
    expect(() => new SequelizeGuard(sequelize, { UserModel })).toThrow(
      'distinct names',
    );
    await expect(
      migration.up(queryInterface, sequelize, { userPk: 'missing' }),
    ).rejects.toThrow('userPk');
    await expect(
      migration.up(queryInterface, sequelize, { UserModel: CompositeUser }),
    ).rejects.toThrow('one primary key');
    const BigUser = sequelize.define('BigAccount', {
      subject: { type: DataTypes.BIGINT, primaryKey: true },
    });
    expect(() => new SequelizeGuard(sequelize, { UserModel: BigUser })).toThrow(
      'safe integers',
    );
    await expect(
      migration.up(queryInterface, sequelize, {
        tables: { roles: 'permissions', permissions: 'rules' },
      }),
    ).rejects.toThrow('legacy name of another guard table');
    expect(await queryInterface.showAllTables()).toEqual([]);
  });

  it('rejects conflicting legacy names before synchronization or fresh migration', async () => {
    const dbOptions = await useFileStorage();
    const queryInterface = sequelize.getQueryInterface();
    await migration.up(queryInterface, sequelize);
    const existing = new SequelizeGuard(sequelize, { sync: false });
    const user = await existing.makeUser();
    await existing.allow('reader', 'read', 'article');
    await existing.assignRole(user, 'reader');
    const options = { tables: { roles: 'renamed_roles' }, sync: false };
    const other = new Sequelize(dbOptions);
    onTestFinished(() => other.close());
    const renamed = new SequelizeGuard(other, options);
    await expect(renamed.sync({ force: true })).rejects.toThrow(
      'Legacy guard table "guard_roles" exists',
    );
    await expect(
      migration.up(queryInterface, sequelize, options),
    ).rejects.toThrow('Legacy guard table "guard_roles" exists');
    expect(await existing.userCan(user, 'read article')).toBe(true);
    expect(await queryInterface.tableExists('guard_renamed_roles')).toBe(false);
  });

  it('refuses a mismatched partial rollback before dropping any existing table', async () => {
    const options = { tables: { resources: 'app_records' } };
    const queryInterface = sequelize.getQueryInterface();
    await migration.up(queryInterface, sequelize, options);
    await queryInterface.dropTable('guard_app_records');
    await queryInterface.createTable('guard_app_records', {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: DataTypes.STRING, allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
    });
    await queryInterface.bulkInsert('guard_app_records', [
      { name: 'app data' },
    ]);
    const before = await queryInterface.showAllTables();

    await expect(
      migration.down(queryInterface, sequelize, options),
    ).rejects.toThrow('guard_app_records');
    expect(await queryInterface.showAllTables()).toEqual(before);
    expect(await queryInterface.select(null, 'guard_app_records')).toEqual([
      expect.objectContaining({ name: 'app data' }),
    ]);

    await queryInterface.renameTable(
      'guard_app_records',
      'preserved_app_records',
    );
    await migration.down(queryInterface, sequelize, options);
    await migration.down(queryInterface, sequelize, options);
    expect(await queryInterface.showAllTables()).toEqual([
      'preserved_app_records',
    ]);
  });

  it('preserves application rows that reference a Guard table on SQLite', async () => {
    const queryInterface = sequelize.getQueryInterface();
    await migration.up(queryInterface, sequelize);
    await queryInterface.bulkInsert('guard_users', [{ id: 1 }]);
    await queryInterface.createTable('app_records', {
      appUser: {
        type: DataTypes.INTEGER,
        references: { model: 'guard_users', key: 'id' },
        onDelete: 'CASCADE',
      },
    });
    await queryInterface.bulkInsert('app_records', [{ appUser: 1 }]);

    await expect(migration.down(queryInterface, sequelize)).rejects.toThrow(
      'application table "app_records" references "guard_users"',
    );
    expect(await queryInterface.select(null, 'app_records')).toEqual([
      { appUser: 1 },
    ]);
    expect(await queryInterface.tableExists('guard_role_user')).toBe(true);
  });

  it.each([
    { names: [' reader '], message: 'Noncanonical legacy role' },
    { names: ['reader', ' reader '], message: 'Legacy role names collide' },
  ])(
    'rejects legacy $names before creating any destination tables',
    async ({ names, message }) => {
      const from = { prefix: 'previous_' };
      const to = { prefix: 'destination_' };
      const queryInterface = sequelize.getQueryInterface();
      const previous = new previousGuard(sequelize, { ...from, sync: true });
      await previous.ready;
      // The published 6.0.2 declarations omitted this runtime extension.
      const makeRole = Reflect.get(previous, 'makeRole') as (
        name: string,
      ) => Promise<unknown>;
      for (const name of names) await makeRole.call(previous, name);
      const original = await queryInterface.select(null, from.prefix + 'roles');
      expect(original.map((role) => (role as { name: string }).name)).toEqual(
        names,
      );
      const create = vi.spyOn(queryInterface, 'createTable');
      await expect(
        migration.upgrade(queryInterface, sequelize, { from, to }),
      ).rejects.toThrow(message);
      expect(create).not.toHaveBeenCalled();
      expect(await queryInterface.select(null, from.prefix + 'roles')).toEqual(
        original,
      );
    },
  );

  it('rolls back failed creation and lets a new migration retry without touching existing data', async () => {
    const App = sequelize.define('App', { value: DataTypes.STRING });
    await App.sync();
    await App.create({ value: 'retained' });
    const queryInterface = sequelize.getQueryInterface();
    const addIndex = vi
      .spyOn(queryInterface, 'addIndex')
      .mockRejectedValueOnce(
        new ConnectionError(new Error('disconnected during index creation')),
      );
    await expect(migration.up(queryInterface, sequelize)).rejects.toThrow(
      'disconnected',
    );
    expect(await queryInterface.showAllTables()).toEqual(['Apps']);
    addIndex.mockRestore();
    await migration.up(queryInterface, sequelize);
    await expect(migration.up(queryInterface, sequelize)).rejects.toThrow(
      'already exists',
    );
    await migration.down(queryInterface, sequelize);
    expect((await App.findOne({ rejectOnEmpty: true })).get('value')).toBe(
      'retained',
    );
  });

  it('never leaves a complete receipt when its final write fails or adopts a replacement table', async () => {
    const query = sequelize.getQueryInterface();
    const insert = query.bulkInsert.bind(query);
    const failure = vi
      .spyOn(query, 'bulkInsert')
      .mockImplementation(async (table, rows, options, attributes) => {
        if (table === 'guard_role_hierarchy')
          throw new Error('receipt write failed');
        return insert(table, rows, options, attributes);
      });
    await expect(migration.up(query, sequelize)).rejects.toThrow(
      'receipt write failed',
    );
    expect(await query.showAllTables()).toEqual([]);
    failure.mockRestore();

    // This coincidental shape must not become owned after the failed run.
    await query.createTable('guard_users', {
      id: { type: DataTypes.INTEGER, primaryKey: true },
    });
    await query.bulkInsert('guard_users', [{ id: 41 }]);
    await expect(migration.up(query, sequelize)).rejects.toThrow(
      'already exists',
    );
    const drop = vi.spyOn(query, 'dropTable');
    await expect(migration.down(query, sequelize)).rejects.toThrow(
      'no Guard ownership receipt',
    );
    expect(drop).not.toHaveBeenCalled();
    expect(await query.select(null, 'guard_users')).toEqual([{ id: 41 }]);
    await query.dropTable('guard_users');
    await migration.up(query, sequelize);
    await migration.down(query, sequelize);
    expect(await query.showAllTables()).toEqual([]);
  });

  it('creates indexes on the exact SQLite physical name when model defaults contain a schema', async () => {
    await sequelize.close();
    sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
      define: { schema: 'tenant' },
    });
    const query = sequelize.getQueryInterface();
    await migration.up(query, sequelize);
    expect(await query.showAllTables()).toContain('tenant.guard_roles');
    expect(await query.showIndex('tenant.guard_roles')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'guard_roles_parent_id' }),
      ]),
    );
    await migration.down(query, sequelize);
    expect(await query.showAllTables()).toEqual([]);
  });

  it.each(['sync', 'migration'])(
    'upgrades actual 6.0.2 %s tables without changing the source',
    async (creation) => {
      const dbOptions = await useFileStorage();
      const source = {
        prefix: 'old_',
        timestamps: true,
        paranoid: true,
        sync: false,
      };
      const target = {
        ...source,
        prefix: 'new_',
        tables: { roles: 'policy_roles' },
      };
      let queryInterface = sequelize.getQueryInterface();
      if (creation === 'sync') {
        const previous = new previousGuard(sequelize, {
          ...source,
          sync: true,
        });
        await previous.ready;
      } else {
        await previousMigration.up(queryInterface, sequelize, source);
      }
      const timestamp = '2024-06-02 12:00:00.000 +00:00';
      const dates =
        creation === 'sync'
          ? { createdAt: timestamp, updatedAt: timestamp, deletedAt: null }
          : { created_at: timestamp, updated_at: timestamp, deleted_at: null };
      await queryInterface.bulkInsert('old_users', [{ id: 12, ...dates }]);
      await queryInterface.bulkInsert('old_roles', [
        { id: 31, name: 'editor', ...dates },
      ]);
      await queryInterface.bulkInsert('old_permissions', [
        {
          id: 11,
          name: 'read article',
          resource: 'article',
          action: '["read"]',
          allow: 1,
          ...dates,
        },
      ]);
      await queryInterface.bulkInsert('old_role_permission', [
        { id: 18, role_id: 31, permission_id: 11, ...dates },
      ]);
      await queryInterface.bulkInsert('old_role_user', [
        { id: 27, role_id: 31, user_id: 12, ...dates },
      ]);
      await sequelize.close();
      sequelize = new Sequelize(dbOptions);
      queryInterface = sequelize.getQueryInterface();
      await migration.upgrade(queryInterface, sequelize, {
        from: source,
        to: target,
      });
      const guard = new SequelizeGuard(sequelize, target);
      const user = await guard
        .models()
        .GuardUser.findByPk(12, { rejectOnEmpty: true });
      expect(await guard.userCan(user, 'read article')).toBe(true);
      expect(await guard.userCan(user, 'edit article')).toBe(false);
      expect(
        (await guard.models().GuardRole.findByPk(31))?.get('createdAt'),
      ).toEqual(new Date(timestamp));
      expect((await guard.makeUser()).id).toBeGreaterThan(12);
      expect(
        await queryInterface.select(null, 'new_role_user', {
          where: { id: 27 },
        }),
      ).toHaveLength(1);

      await migration.down(queryInterface, sequelize, target);
      expect(
        await queryInterface.select(null, 'old_role_user', {
          where: { id: 27 },
        }),
      ).toHaveLength(1);
      expect(
        await queryInterface.select(null, 'old_users', { where: { id: 12 } }),
      ).toHaveLength(1);
    },
  );

  it('leaves a custom user and old policy intact after an invalid upgrade and permits repair then retry', async () => {
    const UserModel = sequelize.define<
      PreviousAccount,
      { id: number; display: string }
    >(
      'Account',
      {
        id: { type: DataTypes.INTEGER, primaryKey: true },
        display: { type: DataTypes.STRING, allowNull: false },
      },
      { timestamps: false },
    );
    await UserModel.sync();
    const queryInterface = sequelize.getQueryInterface();
    await queryInterface.bulkInsert(UserModel.getTableName(), [
      { id: 3, display: 'Retained' },
    ]);
    const source = { prefix: 'old_', UserModel };
    const target = { prefix: 'new_', UserModel };
    await previousMigration.up(queryInterface, sequelize, source);
    await queryInterface.bulkInsert('old_roles', [{ id: 1, name: 'reader' }]);
    await queryInterface.bulkInsert('old_role_user', [
      { id: 4, role_id: 1, user_id: 99 },
    ]);

    await expect(
      migration.upgrade(queryInterface, sequelize, {
        from: source,
        to: source,
      }),
    ).rejects.toThrow('distinct destination');
    await expect(
      migration.upgrade(queryInterface, sequelize, {
        from: source,
        to: target,
      }),
    ).rejects.toBeInstanceOf(ForeignKeyConstraintError);
    expect((await queryInterface.showAllTables()).sort()).toEqual([
      'Accounts',
      'old_permissions',
      'old_resources',
      'old_role_permission',
      'old_role_user',
      'old_roles',
    ]);
    expect(
      await queryInterface.select(null, 'old_role_user', {
        where: { id: 4, user_id: 99 },
      }),
    ).toHaveLength(1);
    await queryInterface.bulkUpdate('old_role_user', { user_id: 3 }, { id: 4 });

    await migration.upgrade(queryInterface, sequelize, {
      from: source,
      to: target,
    });
    expect(
      await queryInterface.select(null, 'new_role_user', {
        where: { id: 4, user_id: 3 },
      }),
    ).toHaveLength(1);
    await migration.down(queryInterface, sequelize, target);
    expect((await UserModel.findByPk(3))?.get('display')).toBe('Retained');
  });
});
