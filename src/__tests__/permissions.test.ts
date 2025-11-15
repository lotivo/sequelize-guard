import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDatabase, closeTestDatabase, TestContext } from './setup';

describe('Permissions', () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await createTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase(context);
  });

  describe('Create permissions', () => {
    it('should create permission with single action', async () => {
      const perms = await context.guard.createPerms('blog', 'view');
      expect(perms[0].name).toBe('blog:[view]');
    });

    it('should create permission with multiple actions', async () => {
      const perms = await context.guard.createPerms('blog', ['view', 'edit']);
      expect(perms[0].name).toBe('blog:[view,edit]');
    });

    it('should not create duplicate permission', async () => {
      const perms = await context.guard.createPerms('blog', ['view', 'edit']);
      expect(perms.length).toBe(0);
    });

    it('should create permission with multiple resources, return created', async () => {
      const perms = await context.guard.createPerms(
        ['blog', 'users'],
        ['view', 'edit'],
        {
          names: ['', 'blog_main'],
          json: true,
        },
      );
      expect(perms.length).toBe(1);
    });

    it('should create permission with multiple resources, return all', async () => {
      const perms = await context.guard.createPerms(
        ['blog', 'users', 'admin'],
        ['view', 'edit'],
        {
          names: ['', 'blog_main'],
          all: true,
        },
      );
      expect(perms.length).toBe(3);
    });
  });

  describe('Create permissions in bulk', () => {
    it('should create permissions in bulk with options, return created', async () => {
      const perms = await context.guard.createPermsBulk(
        [
          {
            resource: 'blog',
            actions: 'view',
          },
          {
            name: 'blog_manage',
            resource: 'blog',
            actions: ['view', 'edit', 'update', 'create'],
          },
        ],
        {
          json: true,
        },
      );
      expect(perms.length).toBe(1);
    });

    it('should create permissions in bulk without options, return created', async () => {
      const perms = await context.guard.createPermsBulk([
        {
          resource: 'blog',
          actions: 'view',
        },
        {
          name: 'gallery_manage',
          resource: 'gallery',
          actions: ['view', 'edit', 'update', 'create'],
        },
      ]);
      expect(perms.length).toBe(1);
    });
  });

  describe('Find permissions', () => {
    it('should find perms by resource action in search mode', async () => {
      const perms = await context.guard.findPerms({
        resource: 'blog',
        action: 'view',
        search: true,
      });
      expect(Array.isArray(perms)).toBe(true);
    });

    it('should find perms by name in search mode', async () => {
      const perms = await context.guard.findPerms({
        name: 'blog',
        search: true,
      });
      expect(Array.isArray(perms)).toBe(true);
    });

    it('should find perms by resource action by exact match', async () => {
      const perms = await context.guard.findPerms({
        resource: 'blog',
        action: 'view',
      });
      expect(Array.isArray(perms)).toBe(true);
    });

    it('should find perms by name by exact match', async () => {
      const perms = await context.guard.findPerms({ name: 'blog:[view]' });
      expect(Array.isArray(perms)).toBe(true);
    });

    it('should return all permissions when no args', async () => {
      const perms = await context.guard.findPerms();
      expect(Array.isArray(perms)).toBe(true);
    });
  });
});
