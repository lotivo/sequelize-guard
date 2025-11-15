import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDatabase, closeTestDatabase, TestContext } from './setup';

describe('Users', () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await createTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase(context);
  });

  describe('Create users', () => {
    it('should create user', async () => {
      const data = await context.guard.makeUser({
        name: 'SuperAdmin',
        email: 'superadmin@test.com',
      });
      expect(data.name).toBe('SuperAdmin');
    });

    it('should create multiple users via bulkCreate', async () => {
      const users = [
        { name: 'SomeAdmin', email: 'someAdmin@test.com' },
        { name: 'flux editor', email: 'editor@test.com' },
        { name: 'User 1', email: 'myuser@test.com' },
      ];
      const data = await context.guard.models().GuardUser.bulkCreate(users);
      expect(data.length).toBe(3);
    });
  });

  describe('User-Role assignments', () => {
    describe('Assign roles', () => {
      it('should assign single role to user', async () => {
        const user = await context.sequelize.models.User.findByPk(1);
        if (
          user &&
          'assignRole' in user &&
          typeof user.assignRole === 'function'
        ) {
          const updatedUser = await (user as any).assignRole('admin');
          const roles = await (updatedUser as any).getRoles();
          expect(roles.length).toBe(1);
        }
      });

      it('should assign multiple roles without duplicates', async () => {
        const user = await context.sequelize.models.User.findByPk(1);
        if (
          user &&
          'assignRoles' in user &&
          typeof user.assignRoles === 'function'
        ) {
          const result = await (user as any).assignRoles([
            'admin',
            'superadmin',
            'moderator',
          ]);
          expect(result.length).toBe(2);

          const roles = await (user as any).getRoles();
          expect(roles.length).toBe(3);
        }
      });
    });

    describe('Remove role assignments', () => {
      it('should remove single role from user', async () => {
        const user = await context.sequelize.models.User.findByPk(1);
        if (
          user &&
          'rmAssignedRoles' in user &&
          typeof user.rmAssignedRoles === 'function'
        ) {
          const result = await (user as any).rmAssignedRoles('admin');
          expect(result).toBe(1);

          const roles = await (user as any).getRoles();
          expect(roles.length).toBe(2);
        }
      });

      it('should remove multiple roles from user', async () => {
        const user = await context.sequelize.models.User.findByPk(1);
        if (
          user &&
          'rmAssignedRoles' in user &&
          typeof user.rmAssignedRoles === 'function'
        ) {
          const result = await (user as any).rmAssignedRoles([
            'superadmin',
            'moderator',
            'toddle',
          ]);
          expect(result).toBe(2);

          const roles = await (user as any).getRoles();
          expect(roles.length).toBe(0);
        }
      });
    });
  });
});
