import { randomBytes } from 'node:crypto';
import {
  DatabaseError,
  DataTypes,
  ForeignKeyConstraintError,
  QueryTypes,
  Sequelize,
  UniqueConstraintError,
  type TableName,
} from 'sequelize';
import { beforeEach, expect, it, onTestFinished } from 'vitest';
import { SequelizeGuard, migration } from '../index';

const url = process.env.SEQUELIZE_GUARD_TEST_DATABASE_URL;
if (!url)
  throw new Error(
    'Set SEQUELIZE_GUARD_TEST_DATABASE_URL to an isolated PostgreSQL or MySQL test database',
  );

let prefix: string;
let sequelize: Sequelize;

beforeEach(() => {
  prefix = `guard_test_${randomBytes(4).toString('hex')}_`;
  sequelize = new Sequelize(url, { logging: false });
  if (!['postgres', 'mysql'].includes(sequelize.getDialect())) {
    throw new Error('External dialect tests require PostgreSQL or MySQL');
  }
  onTestFinished(() => sequelize.close());
});

it('migrates custom table names and a real application key, enforces constraints, and revokes access across connections', async () => {
  const reader = new Sequelize(url, { logging: false });
  onTestFinished(() => reader.close());

  const defineUser = (connection: Sequelize) =>
    connection.define(
      'Account',
      {
        accountKey: {
          type: DataTypes.UUID,
          primaryKey: true,
          field: 'account_key',
        },
        display: { type: DataTypes.STRING, allowNull: false },
      },
      { tableName: prefix + 'accounts' },
    );

  const UserModel = defineUser(sequelize);
  await UserModel.sync();
  onTestFinished(() => UserModel.drop());

  const queryInterface = sequelize.getQueryInterface();
  const options = {
    prefix,
    tables: { users: 'unused', roles: 'profiles', role_user: 'memberships' },
    timestamps: true,
    paranoid: true,
    sync: false,
    UserModel,
  };
  await migration.up(queryInterface, sequelize, options);
  onTestFinished(() => migration.down(queryInterface, sequelize, options));

  const writerGuard = new SequelizeGuard(sequelize, options);
  const readerGuard = new SequelizeGuard(reader, {
    ...options,
    UserModel: defineUser(reader),
  });
  const key = '91a7ede2-d937-41b7-8394-ea3ead1af145';
  await UserModel.create({ accountKey: key, display: 'Required name' });
  const assigned = await writerGuard
    .models()
    .GuardUser.findByPk(key, { rejectOnEmpty: true });
  const checked = await readerGuard
    .models()
    .GuardUser.findByPk(key, { rejectOnEmpty: true });
  const { GuardRole, GuardPermission, RolePermission, RoleUser } =
    writerGuard.models();
  await writerGuard.allow('reader', 'read', 'article');
  await writerGuard.assignRole(assigned, 'reader');
  expect(await readerGuard.userCan(checked, 'read article')).toBe(true);
  const role = await GuardRole.findOne({ rejectOnEmpty: true });
  const permission = await GuardPermission.findOne({ rejectOnEmpty: true });

  await expect(
    RoleUser.create({ role_id: role.id, user_id: key }),
  ).rejects.toBeInstanceOf(UniqueConstraintError);
  await expect(
    RolePermission.create({
      role_id: role.id,
      permission_id: permission.id + 100,
    }),
  ).rejects.toBeInstanceOf(ForeignKeyConstraintError);
  await expect(
    GuardRole.create({ name: 'orphan', parent_id: role.id + 100 }),
  ).rejects.toBeInstanceOf(ForeignKeyConstraintError);
  expect(await queryInterface.showIndex(RoleUser.getTableName())).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        name: prefix + 'memberships_role_id_user_id',
        unique: true,
      }),
    ]),
  );

  await expect(
    sequelize.transaction(async (transaction) => {
      await RoleUser.destroy({
        where: { user_id: key },
        force: true,
        transaction,
      });
      expect(await RoleUser.count({ transaction })).toBe(0);
      throw new Error('cancel policy transaction');
    }),
  ).rejects.toThrow('cancel policy transaction');
  expect(await readerGuard.userCan(checked, 'read article')).toBe(true);
  await writerGuard.rmAssignedRoles(assigned, ['reader']);
  expect(await readerGuard.userCan(checked, 'read article')).toBe(false);

  await migration.down(queryInterface, sequelize, options);
  expect((await UserModel.findByPk(key))?.get('display')).toBe('Required name');
  expect(await queryInterface.tableExists(prefix + 'memberships')).toBe(false);
});

it('recovers from a real foreign-key DDL error during migration and model synchronization', async () => {
  const queryInterface = sequelize.getQueryInterface();
  const tableName = prefix + 'accounts';
  await queryInterface.createTable(tableName, {
    account_key: { type: DataTypes.INTEGER, primaryKey: true },
  });
  const UserModel = sequelize.define(
    'Account',
    {
      accountKey: {
        type: DataTypes.STRING(32),
        primaryKey: true,
        field: 'account_key',
      },
    },
    { tableName, timestamps: false },
  );
  const options = { prefix, UserModel, sync: false };
  onTestFinished(async () => {
    await migration.down(queryInterface, sequelize, options);
    await queryInterface.dropTable(tableName);
  });
  await queryInterface.bulkInsert(tableName, [{ account_key: 9 }]);
  await expect(
    migration.up(queryInterface, sequelize, options),
  ).rejects.toBeInstanceOf(DatabaseError);
  expect(await queryInterface.tableExists(prefix + 'roles')).toBe(false);
  expect(
    await queryInterface.select(null, tableName, { where: { account_key: 9 } }),
  ).toHaveLength(1);

  const guard = new SequelizeGuard(sequelize, options);
  await expect(guard.sync()).rejects.toBeInstanceOf(DatabaseError);
  await queryInterface.dropTable(tableName);
  await expect(guard.sync()).resolves.toBe(guard);
  await UserModel.create({ accountKey: 'account-2' });
  const user = await guard
    .models()
    .GuardUser.findByPk('account-2', { rejectOnEmpty: true });
  await guard.allow('reader', 'read', 'article');
  await guard.assignRole(user, 'reader');
  expect(await guard.userCan(user, 'read article')).toBe(true);
});

it('copies legacy rows and preserves role parents, application ownership and generated IDs', async () => {
  const from = { prefix, sync: false };
  const to = {
    ...from,
    prefix: prefix + 'target_',
    tables: { roles: 'profiles' },
  };
  const queryInterface = sequelize.getQueryInterface();
  await migration.up(queryInterface, sequelize, from);
  onTestFinished(async () => {
    await migration.down(queryInterface, sequelize, to);
    await migration.down(queryInterface, sequelize, from);
  });

  await queryInterface.bulkInsert(prefix + 'roles', [
    { id: 31, name: 'staff', parent_id: null },
    { id: 20, name: 'editor', parent_id: 31 },
  ]);
  await queryInterface.bulkInsert(prefix + 'users', [{ id: 38 }]);
  await queryInterface.bulkInsert(prefix + 'permissions', [
    { id: 9, name: 'read article', action: '["read"]', resource: 'article' },
  ]);
  await queryInterface.bulkInsert(prefix + 'role_permission', [
    { id: 12, role_id: 20, permission_id: 9 },
  ]);
  await queryInterface.bulkInsert(prefix + 'role_user', [
    { id: 11, role_id: 20, user_id: 38 },
  ]);
  await migration.upgrade(queryInterface, sequelize, { from, to });

  const guard = new SequelizeGuard(sequelize, to);
  const user = await guard
    .models()
    .GuardUser.findByPk(38, { rejectOnEmpty: true });
  expect(await guard.userCan(user, 'read article')).toBe(true);
  expect((await guard.models().GuardRole.findByPk(20))?.parent_id).toBe(31);
  expect((await guard.makeUser()).id).toBeGreaterThan(38);
  expect(
    await queryInterface.select(null, prefix + 'role_user', {
      where: { id: 11 },
    }),
  ).toHaveLength(1);
});

it.runIf(new URL(url).protocol.startsWith('postgres'))(
  'keeps PostgreSQL migration and foreign keys on the bound schemas despite a different search path',
  async () => {
    const policySchema = prefix + 'policy';
    const appSchema = prefix + 'app';
    const postgres = new Sequelize(url, {
      logging: false,
      define: { schema: policySchema, underscored: true },
      dialectOptions: { options: `-c search_path=${appSchema},public` },
    });
    const queryInterface = postgres.getQueryInterface();
    onTestFinished(() => postgres.close());
    await queryInterface.createSchema(appSchema);
    await queryInterface.createSchema(policySchema);
    onTestFinished(async () => {
      await queryInterface.dropSchema(policySchema);
      await queryInterface.dropSchema(appSchema);
    });

    const [path] = await postgres.query<{ schema: string }>(
      'SELECT current_schema() AS schema',
      { type: QueryTypes.SELECT },
    );
    expect(path.schema).toBe(appSchema);
    const UserModel = postgres.define(
      'Account',
      {
        accountKey: {
          type: DataTypes.STRING(24),
          primaryKey: true,
          field: 'account_key',
        },
      },
      { tableName: 'accounts', schema: appSchema },
    );
    await UserModel.sync();
    onTestFinished(() => UserModel.drop());
    const options = { UserModel, prefix, timestamps: true, sync: false };
    await migration.up(queryInterface, postgres, options);
    onTestFinished(() => migration.down(queryInterface, postgres, options));
    await UserModel.create({ accountKey: 'user100' });
    const guard = new SequelizeGuard(postgres, options);
    const user = await guard
      .models()
      .GuardUser.findByPk('user100', { rejectOnEmpty: true });
    await guard.allow('reader', 'read', 'article');
    await guard.assignRole(user, 'reader');
    expect(await guard.userCan(user, 'read article')).toBe(true);
    const roleTable: TableName = {
      tableName: prefix + 'roles',
      schema: policySchema,
    };
    expect(await queryInterface.tableExists(roleTable)).toBe(true);
    expect(
      await queryInterface.tableExists({ ...roleTable, schema: appSchema }),
    ).toBe(false);
    expect(await queryInterface.describeTable(roleTable)).toHaveProperty(
      'created_at',
    );
    await expect(
      guard.sync({ force: true, searchPath: appSchema }),
    ).rejects.toThrow('searchPath');
  },
);
