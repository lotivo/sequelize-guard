import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDatabase, closeTestDatabase, TestContext } from './setup';

describe('Authorization', () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await createTestDatabase({ seedData: true });
  });

  afterAll(async () => {
    await closeTestDatabase(context);
  });

  describe('Role checks', () => {
    it('should return all roles of user with 1 role (user_id 1)', async () => {
      const user = await context.guard.models().GuardUser.findByPk(1);

      if (user) {
        const roles = await user.getRoles!();

        expect(roles.length).toBe(1);
      }
    });

    it('should return all roles of user with 2 roles (user_id 2)', async () => {
      const user = await context.guard.models().GuardUser.findByPk(2);

      if (user) {
        const roles = await user.getRoles!();

        expect(roles.length).toBe(2);
      }
    });

    it('should return true if user h of given roles (user_id 1, superadmin)', async () => {
      const user = await context.guard.models().GuardUser.findByPk(1);

      if (user) {
        const result = await user.isAnyOf!(['superadmin', 'admin']);

        expect(result).toBe(true);
      }
    });

    it('should return true if user h of given roles (user_id 2, user & admin)', async () => {
      const user = await context.guard.models().GuardUser.findByPk(2);

      if (user) {
        const result = await user.isAnyOf!(['user', 'admin']);

        expect(result).toBe(true);
      }
    });

    it('should return true if user has all given roles (user_id 2, user & admin)', async () => {
      const user = await context.guard.models().GuardUser.findByPk(2);

      if (user) {
        const result = await user.isAllOf!(['user', 'admin']);

        expect(result).toBe(true);
      }
    });

    it('should return false if user does not have all given roles (user_id 1)', async () => {
      const user = await context.guard.models().GuardUser.findByPk(1);

      if (user) {
        const result = await user.isAllOf!(['admin', 'superadmin']);

        expect(result).toBe(false);
      }
    });

    it('should return false if user does not have all given roles (user_id 2)', async () => {
      const user = await context.guard.models().GuardUser.findByPk(2);

      if (user) {
        const result = await user.isAllOf!(['user', 'admin', 'superadmin']);

        expect(result).toBe(false);
      }
    });

    it('should check isA for single role (user_id 2, user)', async () => {
      const user = await context.guard.models().GuardUser.findByPk(2);

      if (user) {
        const result = await user.isA!('user');

        expect(result).toBe(true);
      }
    });

    it('should check isAn for single role (user_id 2, admin)', async () => {
      const user = await context.guard.models().GuardUser.findByPk(2);

      if (user) {
        const result = await user.isAn!('admin');

        expect(result).toBe(true);
      }
    });

    it('should return false if user does not have given role (user_id 2, superadmin)', async () => {
      const user = await context.guard.models().GuardUser.findByPk(2);

      if (user) {
        const result = await user.isA!('superadmin');

        expect(result).toBe(false);
      }
    });
  });

  describe('Permission checks - all permissions', () => {
    it('should allow superadmin to access wildcard (*)', async () => {
      const user = await context.guard.models().GuardUser.findByPk(1);

      if (user) {
        const result = await user.can!('*');

        expect(result).toBe(true);
      }
    });

    it('should not allow admin to access wildcard (*)', async () => {
      const user = await context.guard.models().GuardUser.findByPk(2);

      if (user) {
        const result = await user.can!('*');

        expect(result).toBe(false);
      }
    });

    it('should not allow user to edit blog', async () => {
      const user = await context.guard.models().GuardUser.findByPk(4);

      if (user) {
        const result = await user.can!('edit blog');

        expect(result).toBe(false);
      }
    });

    it('should check cant method for user edit blog', async () => {
      const user = await context.guard.models().GuardUser.findByPk(4);

      if (user) {
        const result = await user.cant!('edit blog');

        expect(result).toBe(true);
      }
    });
  });

  describe('Permission checks - specific permissions', () => {
    it('should allow user to view blog', async () => {
      const user = await context.sequelize.models.User.findByPk(4);

      if (user) {
        const result = await user.can!('view blog');

        expect(result).toBe(true);
      }
    });

    it('should allow admin to perform any action (*) on blog', async () => {
      const user = await context.sequelize.models.User.findByPk(2);

      if (user) {
        const result = await user.can!('* blog');

        expect(result).toBe(true);
      }
    });

    it('should allow analyst to view any resource (*)', async () => {
      const user = await context.sequelize.models.User.findByPk(3);

      if (user) {
        const result = await user.can!('view *');

        expect(result).toBe(true);
      }
    });

    it('should not allow user to edit blog', async () => {
      const user = await context.sequelize.models.User.findByPk(4);

      if (user) {
        const result = await user.can!('edit blog');

        expect(result).toBe(false);
      }
    });

    it('should setup cache', async () => {
      const cache = await context.guard.getCache();

      expect(cache).toBeDefined();
    });
  });
});
