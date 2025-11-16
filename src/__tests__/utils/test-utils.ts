import type { SequelizeGuard } from '../../index';
import type { SequelizeWithGuard } from '../../types/helpers';

/**
 * Seed test database with baseline roles, permissions, and users
 * This ensures tests have predictable data to work with
 */
export async function seedTestData(
  guard: SequelizeGuard,
  sequelize: SequelizeWithGuard,
): Promise<void> {
  // Create roles
  await guard.makeRoles([
    'superadmin',
    'admin',
    'user',
    'analyst',
    'moderator',
  ]);

  // Create permissions for superadmin (wildcard - all permissions)
  await guard.allow('superadmin', ['*'], '*');

  // Create permissions for admin (wildcard actions on multiple resources)
  await guard.allow('admin', ['*'], ['blog', 'post', 'image']);

  // Create permissions for analyst (view on all resources)
  await guard.allow('analyst', ['view'], '*');

  // Create permissions for user (view only on specific resources)
  await guard.allow('user', ['view'], ['blog', 'post', 'notice']);

  // Create 4 test users
  const users = await sequelize.models.User.bulkCreate([
    {}, // User 1
    {}, // User 2
    {}, // User 3
    {}, // User 4
  ]);

  // Assign roles to users
  // User 1: superadmin
  if (users[0]) {
    await guard.assignRole(users[0] as any, 'superadmin');
  }

  // User 2: admin + user
  if (users[1]) {
    await guard.assignRoles(users[1] as any, ['admin', 'user']);
  }

  // User 3: analyst
  if (users[2]) {
    await guard.assignRole(users[2] as any, 'analyst');
  }

  // User 4: user
  if (users[3]) {
    await guard.assignRole(users[3] as any, 'user');
  }
}
