import { Sequelize } from 'sequelize';
import { expect, expectTypeOf, it, onTestFinished } from 'vitest';
import { SequelizeGuard } from '../index';
import type { RoleAssignmentResult, UserRoleAssignment } from '../index';
import { closeTestDatabase, createTestDatabase } from './setup';

async function setup() {
  const context = await createTestDatabase();
  onTestFinished(() => closeTestDatabase(context));
  return context;
}

it('assigns shared and mixed user roles once per normalized user and role', async () => {
  const { guard } = await setup();
  const users = await guard.models().GuardUser.bulkCreate([{}, {}, {}]);
  const [first, second, third] = users;
  await guard.allow('reader', 'read', 'article');

  const shared = guard.assignRolesToUsers(users, ['reader', ' READER ']);
  expectTypeOf(shared).toEqualTypeOf<Promise<RoleAssignmentResult>>();
  await expect(shared).resolves.toEqual({ assigned: 3 });

  const mixed = [
    { user: first, roles: ['editor', ' reader '] },
    { user: first, roles: [' EDITOR '] },
    { user: second, roles: ['publisher'] },
  ] as const satisfies readonly UserRoleAssignment[];
  await expect(guard.assignUserRoles(mixed)).resolves.toEqual({ assigned: 2 });
  await expect(guard.assignUserRoles(mixed)).resolves.toEqual({ assigned: 0 });
  expect(await guard.userIsA(first, 'editor')).toBe(true);
  expect(await guard.userIsA(second, 'editor')).toBe(false);
  expect(await guard.userIsA(second, 'publisher')).toBe(true);
  expect(await guard.userIsA(third, 'publisher')).toBe(false);
  expect(await guard.userCan(third, 'read article')).toBe(true);
});

it('rejects invalid users and rolls back all changes on insertion failure', async () => {
  const { guard } = await setup();
  const { GuardUser, RoleUser } = guard.models();
  const first = await guard.makeUser();
  const stale = await guard.makeUser();
  await stale.destroy({ force: true });

  for (const invalid of [stale, GuardUser.build()]) {
    await expect(
      guard.assignRolesToUsers([first, invalid], ['new role']),
    ).rejects.toThrow(/persisted|no longer exists/);
  }
  expect(await guard.getRole('new role')).toBeNull();
  const invalidRoles = 'admin' as unknown as string[];
  await expect(guard.assignRolesToUsers([first], invalidRoles)).rejects.toThrow(
    'Roles must be an array of names',
  );
  await expect(
    guard.assignRolesToUsers([first], new Array<string>(1)),
  ).rejects.toThrow('Role name must be a non-empty string');

  const failInsert = 'fail-bulk-assignment';
  RoleUser.addHook('beforeBulkCreate', failInsert, () => {
    throw new Error('membership insertion failed');
  });
  await expect(guard.assignRolesToUsers([first], ['new role'])).rejects.toThrow(
    'membership insertion failed',
  );
  RoleUser.removeHook('beforeBulkCreate', failInsert);
  expect(await guard.getRole('new role')).toBeNull();
  expect(await guard.getUserRoles(first)).toEqual([]);

  const transaction = await guard.sequelize.transaction();
  await expect(
    guard.assignRolesToUsers([first], ['new role'], { transaction }),
  ).resolves.toEqual({ assigned: 1 });
  await transaction.rollback();
  expect(await guard.getRole('new role')).toBeNull();
  expect(await guard.getUserRoles(first)).toEqual([]);
});

it('counts each link once across concurrent connections', async () => {
  const { dbPath, guard } = await setup();
  const connection = new Sequelize({
    dialect: 'sqlite',
    storage: dbPath,
    logging: false,
  });
  onTestFinished(() => connection.close());
  const other = new SequelizeGuard(connection, {
    sync: false,
    timestamps: true,
  });
  const first = await guard.makeUser();
  const copy = await other.models().GuardUser.findByPk(first.id, {
    rejectOnEmpty: true,
  });
  await expect(guard.assignRolesToUsers([copy], ['role'])).rejects.toThrow(
    /guard user model/,
  );

  const result = await Promise.all([
    guard.assignRolesToUsers([first], ['one', 'shared']),
    other.assignRolesToUsers([copy], ['two', 'shared']),
  ]);
  expect(result.map(({ assigned }) => assigned).sort()).toEqual([1, 2]);
  expect(await guard.userHasAllRoles(first, ['one', 'two', 'shared'])).toBe(
    true,
  );
});

it('keeps assignment query count constant within a chunk of new roles and users', async () => {
  const { guard, sequelize } = await setup();
  const users = await guard
    .models()
    .GuardUser.bulkCreate(Array.from({ length: 64 }, () => ({})));
  const countQueries = async (size: number) => {
    let queries = 0;
    const log = () => {
      queries++;
    };
    sequelize.addHook('beforeQuery', 'count-assignment', log);
    try {
      await guard.assignUserRoles(
        users.slice(0, size).map((user, index) => ({
          user,
          roles: [`new role ${size} ${index}`],
        })),
      );
      return queries;
    } finally {
      sequelize.removeHook('beforeQuery', 'count-assignment');
    }
  };
  expect(await countQueries(2)).toBe(await countQueries(64));
});
