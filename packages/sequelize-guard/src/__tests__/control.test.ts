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
      // setup
      // execute
      const res = context.guard.init().allow('admin');
      // assert
      expect(res._roles).toContain('admin');
    });

    it('should not accept anything other than string for role', () => {
      // setup
      // execute
      const res = context.guard
        .init()
        .allow('admin')
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
        .allow(3 as any);
      // assert
      expect(res._roles).toContain('admin');
    });

    it('should add view action to control', () => {
      // setup
      // execute
      const res = context.guard.init().to('view');
      // assert
      expect(res._actions).toContain('view');
    });

    it('should add blog resource to control', () => {
      // setup
      // execute
      const res = context.guard.init().on('blog');
      // assert
      expect(res._resources).toContain('blog');
    });

    it('should reset control sets', () => {
      // setup
      // execute
      const res = context.guard.init();
      // assert
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
      // setup
      const user = await context.sequelize.models.User.findByPk(1);
      // execute
      if (user) {
        const updatedUser = await context.guard.assignRole(user, 'superadmin');
        const roles = await updatedUser.getRoles!();
        // assert
        expect(roles.length).toBe(1);
      }
    });

    it('should assign multiple roles to user', async () => {
      // setup
      const user = await context.sequelize.models.User.findByPk(2);
      // execute
      if (user) {
        await context.guard.assignRoles(user, ['superadmin', 'admin', 'user']);
        const roles = await user.getRoles!();
        // assert
        expect(roles.length).toBe(3);
      }
    });

    it('should assign roles to multiple users', async () => {
      // setup
      const user3 = await context.sequelize.models.User.findByPk(3);
      // execute
      if (user3) {
        const updatedUser = await context.guard.assignRole(user3, 'analyst');
        const roles = await updatedUser.getRoles!();
        // assert
        expect(roles.length).toBe(1);
      }

      // setup
      const user4 = await context.sequelize.models.User.findByPk(4);
      // execute
      if (user4) {
        const updatedUser = await context.guard.assignRole(user4, 'user');
        const roles = await updatedUser.getRoles!();
        // assert
        expect(roles.length).toBe(1);
      }
    });

    it('should remove assigned roles from user', async () => {
      // setup
      const user = await context.sequelize.models.User.findByPk(2);
      // execute
      if (user) {
        const res = await context.guard.rmAssignedRoles(user, ['superadmin']);
        // assert
        expect(res).toBe(1);
        const roles = await user.getRoles!();
        expect(roles.length).toBe(2);
      }
    });
  });
});
