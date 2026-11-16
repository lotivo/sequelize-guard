import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
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

    it('rejects invalid builder input before changing the statement', () => {
      const control = context.guard.init().allow('admin').to('view').on('blog');
      expect(() => control.allow(3 as unknown as string)).toThrow('Role name');
      expect(() => control.to(['edit', 'two words'])).toThrow('actions');
      expect(() => control.on([])).toThrow('resource');
      expect(control._roles).toBe('admin');
      expect(control._actions).toEqual(['view']);
      expect(control._resources).toEqual(['blog']);
    });

    it('keeps an incomplete statement available for completion', async () => {
      const control = context.guard.init().allow('complete-later').to('read');
      await expect(control.commit()).rejects.toThrow('resource');
      const result = await control.on('article').commit();
      expect(result.role.name).toBe('complete-later');
    });

    it('consumes each complete statement before calling the database', async () => {
      const guard = context.guard;
      const control = guard.init();
      const commit = vi.spyOn(guard, 'addPermsToRole');
      try {
        const unavailable = new Error('write failed');
        commit.mockRejectedValueOnce(unavailable);
        const failed = control.allow('first').to('read').on('draft').commit();
        const retried = control
          .allow('second')
          .to('edit')
          .on('article')
          .commit();
        await expect(failed).rejects.toBe(unavailable);
        await expect(retried).resolves.toMatchObject({
          role: { name: 'second' },
          permissions: [{ resource: 'article' }],
        });
        await expect(control.commit()).rejects.toThrow('Role name');
        expect(commit.mock.calls.map((call) => call.slice(0, 3))).toEqual([
          ['first', ['read'], ['draft']],
          ['second', ['edit'], ['article']],
        ]);
      } finally {
        commit.mockRestore();
      }
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
      const user = await context.guard.makeUser();
      const updatedUser = await context.guard.assignRole(user, 'superadmin');
      expect((await updatedUser.getRoles()).map((role) => role.name)).toEqual([
        'superadmin',
      ]);
    });

    it('should assign multiple roles to user', async () => {
      const user = await context.guard.makeUser();
      await context.guard.assignRoles(user, ['superadmin', 'admin', 'user']);
      expect(await user.getRoles()).toHaveLength(3);
    });

    it('should assign roles to multiple users', async () => {
      const analyst = await context.guard.makeUser();
      const reader = await context.guard.makeUser();
      await context.guard.assignRole(analyst, 'analyst');
      await context.guard.assignRole(reader, 'user');
      expect(await analyst.isA('analyst')).toBe(true);
      expect(await reader.isA('user')).toBe(true);
    });

    it('should remove assigned roles from user', async () => {
      const user = await context.guard.makeUser();
      await context.guard.assignRoles(user, ['superadmin', 'admin', 'user']);
      expect(await user.isA('superadmin')).toBe(true);
      await context.guard.rmAssignedRoles(user, ['superadmin']);
      expect(await user.getRoles()).toHaveLength(2);
      expect(await user.isA('superadmin')).toBe(false);
    });
  });
});
