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
import { beforeEach, expect, it, onTestFinished, vi } from 'vitest';
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
    const unbound = new Sequelize(url, {
      logging: false,
      dialectOptions: { options: `-c search_path=public,${appSchema}` },
    });
    onTestFinished(() => unbound.close());
    const unboundGuard = new SequelizeGuard(unbound, { prefix, sync: false });
    await expect(unboundGuard.sync({ force: true })).rejects.toThrow(
      'search path extends beyond public',
    );
    await expect(
      migration.up(unbound.getQueryInterface(), unbound, { prefix }),
    ).rejects.toThrow('search path extends beyond public');
    await expect(
      guard.sync({ force: true, searchPath: appSchema }),
    ).rejects.toThrow('searchPath');

    const applicationTable = { ...roleTable, schema: appSchema };
    await queryInterface.createTable(applicationTable, {
      value: DataTypes.STRING,
    });
    await queryInterface.bulkInsert(applicationTable, [
      { value: 'application data' },
    ]);
    await migration.down(queryInterface, postgres, options);
    expect(await queryInterface.tableExists(roleTable)).toBe(false);
    expect(await queryInterface.select(null, applicationTable)).toEqual([
      { value: 'application data' },
    ]);
  },
);

it.runIf(new URL(url).protocol === 'mysql:')(
  'never cleans up a table created by a competing migration',
  async () => {
    const competing = new Sequelize(url, { logging: false });
    onTestFinished(() => competing.close());
    const winner = sequelize.getQueryInterface();
    const loser = competing.getQueryInterface();
    const options = { prefix };
    const resources = prefix + 'resources';
    const application = prefix + 'app_records';
    await winner.createTable(application, {
      value: { type: DataTypes.STRING },
    });
    await winner.bulkInsert(application, [{ value: 'app data' }]);
    onTestFinished(async () => {
      await migration.down(winner, sequelize, options);
      await winner.dropTable(application);
    });

    const created = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    sequelize.addHook('afterQuery', async (_options, query) => {
      const sql: unknown = Reflect.get(query, 'sql');
      if (
        typeof sql === 'string' &&
        sql.startsWith('CREATE TABLE') &&
        sql.includes(resources)
      ) {
        created.resolve();
        await release.promise;
      }
    });
    const tableExists = loser.tableExists.bind(loser);
    let successful: Promise<void> | undefined;
    vi.spyOn(loser, 'tableExists').mockImplementation(
      async (table, queryOptions) => {
        const exists = await tableExists(table, queryOptions);
        if (table === prefix + 'role_user') {
          successful = migration.up(winner, sequelize, options);
          await Promise.race([created.promise, successful]);
          await winner.bulkInsert(resources, [{ name: 'winner data' }]);
        }
        return exists;
      },
    );

    try {
      await expect(migration.up(loser, competing, options)).rejects.toThrow();
      expect(await winner.tableExists(resources)).toBe(true);
    } finally {
      release.resolve();
      await successful;
    }
    expect(await winner.tableExists(resources)).toBe(true);
    expect(await winner.tableExists(prefix + 'role_user')).toBe(true);
    expect(await winner.select(null, resources)).toEqual([
      expect.objectContaining({ name: 'winner data' }),
    ]);
    expect(await winner.select(null, application)).toEqual([
      { value: 'app data' },
    ]);
  },
);

it.runIf(new URL(url).protocol === 'mysql:')(
  'preserves every Guard table when another database references a rollback target',
  async () => {
    const queryInterface = sequelize.getQueryInterface();
    const options = { prefix, sync: false };
    const applicationDatabase = prefix + 'app';
    const referenced = [sequelize.getDatabaseName(), prefix + 'users']
      .map((identifier) => queryInterface.quoteIdentifier(identifier))
      .join('.');
    const application = [applicationDatabase, prefix + 'role_user']
      .map((identifier) => queryInterface.quoteIdentifier(identifier))
      .join('.');

    const quotedDatabase = queryInterface.quoteIdentifier(applicationDatabase);
    await sequelize.query(`CREATE DATABASE ${quotedDatabase}`);
    onTestFinished(async () => {
      await sequelize.query(`DROP DATABASE ${quotedDatabase}`);
      await migration.down(queryInterface, sequelize, options);
    });
    await migration.up(queryInterface, sequelize, options);
    const guard = new SequelizeGuard(sequelize, options);
    const user = await guard.makeUser();
    await guard.allow('reader', 'read', 'article');
    await guard.assignRole(user, 'reader');
    await sequelize.query(
      `CREATE TABLE ${application} (
        id INT PRIMARY KEY,
        guard_user_id INT NOT NULL,
        FOREIGN KEY (guard_user_id) REFERENCES ${referenced}(id)
      ) ENGINE=InnoDB`,
    );
    await sequelize.query(
      `INSERT INTO ${application} (id, guard_user_id) VALUES ($1, $2)`,
      {
        bind: [41, user.id],
      },
    );

    const guardTables = async () =>
      (await queryInterface.showAllTables())
        .filter((name) => name.startsWith(prefix))
        .sort();
    const before = await guardTables();
    const rollback = migration.down(queryInterface, sequelize, options);
    await expect(rollback).rejects.toThrow();
    expect(await guardTables()).toEqual(before);
    expect(await guard.userCan(user, 'read article')).toBe(true);
    expect(
      await sequelize.query(`SELECT id, guard_user_id FROM ${application}`, {
        type: QueryTypes.SELECT,
      }),
    ).toEqual([{ id: 41, guard_user_id: user.id }]);
    await expect(rollback).rejects.toThrow(applicationDatabase);
  },
);

it.runIf(new URL(url).protocol === 'mysql:')(
  'cleans up only its own partial schema and never leaves a complete receipt after a failed final write',
  async () => {
    const query = sequelize.getQueryInterface();
    const options = { prefix };
    const insert = query.bulkInsert.bind(query);
    const failure = vi
      .spyOn(query, 'bulkInsert')
      .mockImplementation(async (table, rows, queryOptions, attributes) => {
        if (table === prefix + 'role_hierarchy')
          throw new Error('receipt insert failed');
        return insert(table, rows, queryOptions, attributes);
      });
    await expect(migration.up(query, sequelize, options)).rejects.toThrow(
      'receipt insert failed',
    );
    failure.mockRestore();
    const remaining = (await query.showAllTables()).filter((table) =>
      String(table).startsWith(prefix),
    );
    expect(remaining).toEqual([]);
    await migration.up(query, sequelize, options);
    await migration.down(query, sequelize, options);
  },
);

it.runIf(new URL(url).protocol === 'mysql:')(
  'revokes its receipt before any nontransactional DROP and preserves reused names after interrupted rollback',
  async () => {
    const query = sequelize.getQueryInterface();
    const options = { prefix };
    await migration.up(query, sequelize, options);
    const removeReceipt = vi
      .spyOn(query, 'bulkDelete')
      .mockRejectedValueOnce(new Error('cannot revoke receipt'));
    const drop = vi.spyOn(query, 'dropTable');
    await expect(migration.down(query, sequelize, options)).rejects.toThrow(
      'cannot revoke receipt',
    );
    expect(drop).not.toHaveBeenCalled();
    removeReceipt.mockRestore();
    const actualDrop = query.dropTable.bind(query);
    drop.mockRestore();
    const interrupted = vi
      .spyOn(query, 'dropTable')
      .mockImplementation(async (table, queryOptions) => {
        if (table === prefix + 'role_permission')
          throw new Error('interrupted DDL');
        return actualDrop(table, queryOptions);
      });
    await expect(migration.down(query, sequelize, options)).rejects.toThrow(
      'interrupted DDL',
    );
    interrupted.mockRestore();
    expect(await query.select(null, prefix + 'role_hierarchy')).toEqual([]);
    await query.createTable(prefix + 'role_user', {
      id: { type: DataTypes.INTEGER, primaryKey: true },
    });
    await query.bulkInsert(prefix + 'role_user', [{ id: 91 }]);
    const retryDrop = vi.spyOn(query, 'dropTable');
    await expect(migration.down(query, sequelize, options)).rejects.toThrow(
      'ownership receipt is missing or invalid',
    );
    await expect(migration.up(query, sequelize, options)).rejects.toThrow(
      'already exists',
    );
    expect(retryDrop).not.toHaveBeenCalled();
    expect(await query.select(null, prefix + 'role_user')).toEqual([
      { id: 91 },
    ]);
    retryDrop.mockRestore();
    // Explicit operator recovery: these are isolated test-owned tables.
    for (const table of [
      'role_user',
      'role_permission',
      'roles',
      'permissions',
      'resources',
      'users',
      'role_hierarchy',
    ]) {
      await query.dropTable(prefix + table);
    }
  },
);

it.runIf(new URL(url).protocol === 'mysql:')(
  'fails closed when cleanup of an incomplete MySQL creation also fails',
  async () => {
    const query = sequelize.getQueryInterface();
    const options = { prefix };
    const addIndex = vi
      .spyOn(query, 'addIndex')
      .mockRejectedValueOnce(new Error('index creation failed'));
    const drop = vi
      .spyOn(query, 'dropTable')
      .mockRejectedValueOnce(new Error('cleanup connection failed'));
    await expect(migration.up(query, sequelize, options)).rejects.toThrow(
      'could not remove all newly created tables',
    );
    addIndex.mockRestore();
    drop.mockRestore();
    expect(await query.tableExists(prefix + 'role_hierarchy')).toBe(false);
    // The failed runner never created this name, so its retry cannot claim it.
    await query.createTable(prefix + 'users', {
      id: { type: DataTypes.INTEGER, primaryKey: true },
    });
    await query.bulkInsert(prefix + 'users', [{ id: 17 }]);
    const retryDrop = vi.spyOn(query, 'dropTable');
    await expect(migration.up(query, sequelize, options)).rejects.toThrow(
      'already exists',
    );
    await expect(migration.down(query, sequelize, options)).rejects.toThrow(
      'no Guard ownership receipt',
    );
    expect(retryDrop).not.toHaveBeenCalled();
    expect(await query.select(null, prefix + 'users')).toEqual([{ id: 17 }]);
    retryDrop.mockRestore();
    for (const table of ['roles', 'permissions', 'resources', 'users'])
      await query.dropTable(prefix + table);
  },
);
