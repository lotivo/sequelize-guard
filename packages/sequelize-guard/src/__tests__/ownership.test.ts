import { DataTypes, Sequelize } from 'sequelize';
import { expect, it, onTestFinished, vi } from 'vitest';
import { migration, SequelizeGuard } from '../index';
import { cleanupDbFile, generateDbPath } from './utils/db-utils';

function database() {
  const storage = generateDbPath('ownership');
  const connections: Sequelize[] = [];
  onTestFinished(async () => {
    await Promise.all(connections.map((sequelize) => sequelize.close()));
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

const id = { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true };

it('refuses to sync or drop an application table shaped like built-in users without an ownership receipt', async () => {
  const connect = database();
  const sequelize = connect();
  const Records = sequelize.define(
    'Records',
    { id },
    {
      tableName: 'auth_records',
      timestamps: false,
    },
  );
  await Records.sync();
  await Records.create({});
  const query = sequelize.getQueryInterface();
  const opts = { prefix: 'auth_', tables: { users: 'records' }, sync: false };
  const guard = new SequelizeGuard(connect(), opts);
  const drop = vi.spyOn(query, 'dropTable');

  await expect(migration.down(query, sequelize, opts)).rejects.toThrow(
    'has no Guard ownership receipt',
  );
  await expect(guard.sync()).rejects.toThrow('has no Guard ownership receipt');
  await expect(guard.sync({ force: true })).rejects.toThrow(
    'has no Guard ownership receipt',
  );
  expect(drop).not.toHaveBeenCalled();
  await expect(Records.count()).resolves.toBe(1);
  expect(await query.showAllTables()).toEqual(['auth_records']);
});

it('checks the original owned table names before continuing a partial rollback', async () => {
  const connect = database();
  const sequelize = connect();
  const query = sequelize.getQueryInterface();
  const correct = {
    prefix: 'auth_',
    tables: { users: 'Á' },
    sync: false,
  };
  const wrong = { ...correct, tables: { users: 'á' } };
  const Records = sequelize.define(
    'Records',
    { id },
    {
      tableName: 'auth_á',
      timestamps: false,
    },
  );
  await Records.sync();
  await Records.create({});
  await migration.up(query, sequelize, correct);
  // Simulate a rollback interrupted after dropping the original user tables.
  await query.dropTable('auth_role_user');
  await query.dropTable('auth_Á');
  const before = await query.showAllTables();
  const drop = vi.spyOn(query, 'dropTable');

  await expect(migration.down(query, sequelize, wrong)).rejects.toThrow(
    'ownership receipt does not match',
  );
  const wrongGuard = new SequelizeGuard(connect(), wrong);
  await expect(wrongGuard.sync({ force: true })).rejects.toThrow(
    'ownership receipt does not match',
  );
  expect(drop).not.toHaveBeenCalled();
  expect(await query.showAllTables()).toEqual(before);
  await expect(Records.count()).resolves.toBe(1);

  await migration.down(query, sequelize, correct);
  expect(await query.showAllTables()).toEqual(['auth_á']);
  await migration.down(query, sequelize, correct);
  await expect(Records.count()).resolves.toBe(1);
});

it('blocks a remapped user model from inheriting policy and allows an explicit forced user sync', async () => {
  const connect = database();
  const sequelize = connect();
  const define = (connection: Sequelize, name: string, tableName: string) =>
    connection.define(name, { id }, { tableName, timestamps: false });
  const UserModel = define(sequelize, 'Customer', 'Á');
  const strangers = define(sequelize, 'Contractor', 'á');
  await UserModel.sync();
  await strangers.sync();
  const user = await UserModel.create({ id: 42 });
  await strangers.create({ id: 42 });
  const guard = new SequelizeGuard(sequelize, { UserModel });
  await guard.ready;
  await guard.allow('reader', 'read', 'article');
  await guard.assignRole(user, 'reader');
  expect(await guard.userCan(user, 'read article')).toBe(true);

  const alternate = connect();
  const wrongModel = define(alternate, 'Contractor', 'á');
  const other = new SequelizeGuard(alternate, {
    UserModel: wrongModel,
    sync: false,
  });
  const stranger = await wrongModel.findByPk(42, { rejectOnEmpty: true });
  await expect(other.userCan(stranger, 'read article')).resolves.toBe(false);
  await expect(other.getUserRoles(stranger)).resolves.toEqual([]);
  await expect(other.assignRole(stranger, 'reader')).rejects.toThrow(
    'not initialized',
  );
  await expect(other.sync()).rejects.toThrow(
    'ownership receipt does not match',
  );
  await expect(guard.userCan(user, 'read article')).resolves.toBe(true);
  await guard.sync({ force: true });
  await expect(UserModel.count()).resolves.toBe(0);
  await expect(strangers.count()).resolves.toBe(1);
  await expect(guard.userCan(user, 'read article')).resolves.toBe(false);
});

it('separates SQLite holder grants for distinct Unicode table names sharing a key', async () => {
  const connect = database();
  const sequelize = connect();
  const define = (connection: Sequelize, name: string, tableName: string) =>
    connection.define(name, { id }, { tableName, timestamps: false });
  const Device = define(sequelize, 'Device', 'Á');
  const Unrelated = define(sequelize, 'Unrelated', 'á');
  await Device.sync();
  await Unrelated.sync();
  const device = await Device.create({ id: 42 });
  await Unrelated.create({ id: 42 });

  const guard = new SequelizeGuard(sequelize, {
    roleHolders: { device: Device },
  });
  await guard.ready;
  await guard.allow('reader', 'read', 'article');
  await guard.assignRolesToHolder(device, ['reader']);
  await expect(guard.holderCan(device, 'read article')).resolves.toBe(true);

  const alternate = connect();
  const differentDevice = define(alternate, 'Unrelated', 'á');
  const remapped = new SequelizeGuard(alternate, {
    sync: false,
    roleHolders: { device: differentDevice },
  });
  const stranger = await differentDevice.findByPk(42, { rejectOnEmpty: true });
  await expect(remapped.holderCan(stranger, 'read article')).rejects.toThrow(
    /no such table/,
  );
  await expect(remapped.sync()).rejects.toThrow('ownership receipt');
});

it('protects a SQLite application table whose Unicode name differs only by case from a referenced Guard table', async () => {
  const sequelize = database()();
  const query = sequelize.getQueryInterface();
  const options = { prefix: '', tables: { users: 'Á' } };
  await migration.up(query, sequelize, options);
  await query.bulkInsert('Á', [{ id: 1 }]);
  await query.createTable('á', {
    user: {
      type: DataTypes.INTEGER,
      references: { model: 'Á', key: 'id' },
      onDelete: 'CASCADE',
    },
  });
  await query.bulkInsert('á', [{ user: 1 }]);
  await expect(migration.down(query, sequelize, options)).rejects.toThrow(
    'application table "á" references "Á"',
  );
  expect(await query.select(null, 'á')).toEqual([{ user: 1 }]);
  await expect(query.tableExists('Á')).resolves.toBe(true);
});
