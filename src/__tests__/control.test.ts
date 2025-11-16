import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDatabase, closeTestDatabase, TestContext } from './setup';

describe('Control and Guard Setup', () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await createTestDatabase({ seedData: false });
  });

  afterAll(async () => {
    await closeTestDatabase(context);
  });

  describe('MakeControl', () => {
    it('should add admin role to control', () => {
      const res = context.guard.init().allow('admin');
      expect(res._roles).toContain('admin');
    });

    it('should not accept anything other than string for role', () => {
      const res = context.guard
        .init()
        .allow('admin')
        .allow(3 as any);
      expect(res._roles).toContain('admin');
    });

    it('should add view action to control', () => {
      const res = context.guard.init().to('view');
      expect(res._actions).toContain('view');
    });

    it('should add blog resource to control', () => {
      const res = context.guard.init().on('blog');
      expect(res._resources).toContain('blog');
    });

    it('should reset control sets', () => {
      const res = context.guard.init();
      expect(res._roles.length).toBe(0);
      expect(res._actions.length).toBe(0);
      expect(res._resources.length).toBe(0);
    });

    it('should commit basic control', async () => {
      const permissions = await context.guard
        .models()
        .GuardPermission.findAll();

      console.log(
        'Existing permissions:',
        permissions.map((p) => p.toJSON()),
      );
      const data = await context.guard
        .init()
        .allow('admin')
        .to(['view', 'edit'])
        .on('blog')
        .commit();
      debugger;
      expect(data.permissions.length).toBe(1);
      expect(data.role.name).toBe('admin');
    });

    it('should commit control with wildcard actions and resources', async () => {
      const data = await context.guard
        .init()
        .allow('superadmin')
        .to(['*'])
        .on('*')
        .commit();
      expect(data.permissions.length).toBe(1);
      expect(data.role.name).toBe('superadmin');
    });

    it('should commit control with wildcard actions and multiple resources', async () => {
      const data = await context.guard
        .init()
        .allow('admin')
        .to(['*'])
        .on(['blog', 'post', 'image'])
        .commit();
      expect(data.permissions.length).toBe(4);
      expect(data.role.name).toBe('admin');
    });

    it('should commit control with multiple resources and actions', async () => {
      const data = await context.guard
        .init()
        .on(['blog', 'post', 'image', 'notice'])
        .allow('moderator')
        .to(['view', 'edit', 'update'])
        .commit();
      expect(data.permissions.length).toBe(4);
      expect(data.role.name).toBe('moderator');
    });

    it('should use SequelizeGuard allow API directly', async () => {
      const data = await context.guard.allow(
        'user',
        ['view'],
        ['blog', 'post', 'notice'],
      );
      expect(data.permissions.length).toBe(3);
      expect(data.role.name).toBe('user');
    });

    it('should create new role with allow API', async () => {
      const data = await context.guard.allow('user8', ['view'], ['gallery']);
      expect(data.permissions.length).toBe(1);
      expect(data.role.name).toBe('user8');
    });
  });

  describe('GuardSetup', () => {
    it('should assign role to user', async () => {
      const user = await context.sequelize.models.User.findByPk(1);
      if (user) {
        const updatedUser = await context.guard.assignRole(user, 'superadmin');
        const roles = await updatedUser.getRoles!();
        expect(roles.length).toBe(1);
      }
    });

    it('should assign multiple roles to user', async () => {
      const user = await context.sequelize.models.User.findByPk(2);
      if (user) {
        await context.guard.assignRoles(user, ['superadmin', 'admin', 'user']);

        const roles = await user.getRoles!();

        expect(roles.length).toBe(3);
      }
    });

    it('should assign roles to multiple users', async () => {
      const user3 = await context.sequelize.models.User.findByPk(3);
      if (user3) {
        const updatedUser = await context.guard.assignRole(user3, 'analyst');
        const roles = await updatedUser.getRoles!();
        expect(roles.length).toBe(1);
      }

      const user4 = await context.sequelize.models.User.findByPk(4);
      if (user4) {
        const updatedUser = await context.guard.assignRole(user4, 'user');
        const roles = await updatedUser.getRoles!();
        expect(roles.length).toBe(1);
      }
    });

    it('should remove assigned roles from user', async () => {
      const user = await context.sequelize.models.User.findByPk(2);
      if (user) {
        const res = await context.guard.rmAssignedRoles(user, ['superadmin']);
        expect(res).toBe(1);

        const roles = await user.getRoles!();
        expect(roles.length).toBe(2);
      }
    });
  });
});
