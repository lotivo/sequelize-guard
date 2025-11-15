import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDatabase, closeTestDatabase, TestContext } from './setup';

describe('Roles', () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await createTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase(context);
  });

  describe('Create roles', () => {
    it('should create role by string', async () => {
      const data = await context.guard.makeRole('admin');
      expect(data.role.name).toBe('admin');
    });

    it('should create role by object', async () => {
      const data = await context.guard.makeRole({ name: 'admin2' });
      expect(data.role.name).toBe('admin2');
    });

    it('should not create role for empty string', async () => {
      await expect(context.guard.makeRole('')).rejects.toThrow();
    });

    it('should create multiple roles, not create duplicates, return created roles', async () => {
      const data = await context.guard.makeRoles([
        'admin',
        'moderator',
        { name: 'user', description: 'A basic user' },
      ]);
      expect(data.length).toBe(2);
    });

    it('should create multiple roles, return all roles', async () => {
      const data = await context.guard.makeRoles(
        ['admin', 'analyst', { name: 'user', description: 'A basic user' }],
        { all: true, json: true },
      );
      expect(data.length).toBe(3);
    });
  });

  describe('Find roles', () => {
    it('should return all roles', async () => {
      const roles = await context.guard.allRoles();
      expect(roles.length).toBe(5);
    });

    it('should find roles by name', async () => {
      const roles = await context.guard.findRoles({ name: 'admin' });
      expect(roles[0].name).toBe('admin');
    });

    it('should find roles by names array, exact match', async () => {
      const roles = await context.guard.findRoles({
        names: ['admin', 'analyst', 'admin5'],
      });
      expect(roles.length).toBe(2);
    });

    it('should find roles by names array, search mode', async () => {
      const roles = await context.guard.findRoles({
        names: ['admin', 'mod'],
        search: true,
      });
      expect(roles.length).toBe(3);
    });

    it('should find roles by names with parents', async () => {
      const roles = await context.guard.findRoles({
        names: ['admin', 'mod'],
        search: true,
        withParent: true,
      });
      expect(roles.length).toBe(3);
    });

    it('should return all roles when no params passed', async () => {
      const roles = await context.guard.findRoles();
      expect(roles.length).toBe(5);
    });

    it('should return all roles when names array is empty', async () => {
      const roles = await context.guard.findRoles({ names: [] });
      expect(roles.length).toBe(5);
    });

    it('should get role data by name', async () => {
      const role = await context.guard.getRole('admin');
      expect(role?.name).toBe('admin');
    });

    it('should return null if role not found', async () => {
      const role = await context.guard.getRole('adminNotFound');
      expect(role).toBe(null);
    });
  });

  describe('Delete roles', () => {
    it('should delete single role', async () => {
      const data = await context.guard.deleteRoles('admin');
      expect(data).toBe(1);
    });

    it('should delete multiple roles', async () => {
      const data = await context.guard.deleteRoles([
        'admin',
        { name: 'moderator' },
      ]);
      expect(data).toBe(1);
    });

    it('should return 0 if role not found', async () => {
      const data = await context.guard.deleteRoles('admin3');
      expect(data).toBe(0);
    });

    it('should throw error for invalid argument', async () => {
      await expect(
        context.guard.deleteRoles([3 as any, 'analyst', { name: 'moderator' }]),
      ).rejects.toThrow();
    });
  });

  describe('Role permissions', () => {
    it('should add permissions to role', async () => {
      const data = await context.guard.addPermsToRole(
        'analyst',
        ['view'],
        ['*', 'resAnalyst'],
      );
      expect(data.permissions.length).toBe(2);
      expect(data.role.name).toBe('analyst');
    });

    it('should remove permissions from role', async () => {
      const data = await context.guard.rmPermsFromRole(
        'analyst',
        ['view'],
        ['resAnalyst'],
      );
      expect(data.permissions.length).toBe(1);
      expect(data.role.name).toBe('analyst');
    });

    it('should handle removing permissions from non-existent role', async () => {
      const data = await context.guard.rmPermsFromRole(
        'analyst2',
        ['view'],
        ['resAnalyst'],
      );
      expect(data.permissions.length).toBe(0);
      expect(data.role.name).toBe('analyst2');
    });
  });
});
