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
      const data = await context.guard.makeUser();
      expect(data).toBeDefined();
    });

    it('should create multiple users via bulkCreate', async () => {
      const users = [{}, {}, {}];
      const data = await context.guard.models().GuardUser.bulkCreate(users);
      expect(data.length).toBe(3);
    });
  });

  describe('User-Role assignments', () => {
    describe('Assign roles', () => {
      it('should assign single role to user', async () => {
        const user = await context.sequelize.models.User.findByPk(1);
        if (user) {
          await user.assignRole!('admin');

          const roles = await user.getRoles!();
          expect(roles?.length).toBe(1);
        }
      });

      it('should assign multiple roles without duplicates', async () => {
        const user = await context.sequelize.models.User.findByPk(1);
        if (user) {
          await user.assignRoles!(['admin', 'superadmin', 'moderator']);

          const roles = await user.getRoles!();
          expect(roles?.length).toBe(3);
        }
      });
    });

    describe('Remove role assignments', () => {
      it('should remove single role from user', async () => {
        const user = await context.sequelize.models.User.findByPk(1);

        if (user) {
          await user.rmAssignedRoles!(['admin']);

          const roles = await user.getRoles!();
          expect(roles?.length).toBe(2);
        }
      });

      it('should remove multiple roles from user', async () => {
        const user = await context.sequelize.models.User.findByPk(1);
        if (user) {
          await user.rmAssignedRoles!(['superadmin', 'moderator', 'toddle']);

          const roles = await user.getRoles!();
          expect(roles?.length).toBe(0);
        }
      });
    });
  });
});
