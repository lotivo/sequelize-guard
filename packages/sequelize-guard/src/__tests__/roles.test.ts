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
      // setup
      // execute
      const data = await context.guard.makeRole('admin');
      // assert
      expect(data.role.name).toBe('admin');
    });

    it('should create role by object', async () => {
      // setup
      // execute
      const data = await context.guard.makeRole({ name: 'admin2' });
      // assert
      expect(data.role.name).toBe('admin2');
    });

    it('should not create role for empty string', async () => {
      // setup
      // execute & assert
      await expect(context.guard.makeRole('')).rejects.toThrow();
    });

    it('should create multiple roles, not create duplicates, return created roles', async () => {
      // setup
      const roles = [
        'admin',
        'moderator',
        { name: 'user', description: 'A basic user' },
      ];
      // execute
      const data = await context.guard.makeRoles(roles);
      // assert
      expect(data.length).toBe(2);
    });

    it('should create multiple roles, return all roles', async () => {
      // setup
      const roles = [
        'admin',
        'analyst',
        { name: 'user', description: 'A basic user' },
      ];
      // execute
      const data = await context.guard.makeRoles(roles, {
        all: true,
        json: true,
      });
      // assert
      expect(data.length).toBe(3);
    });
  });

  describe('Find roles', () => {
    it('should return all roles', async () => {
      // setup
      // execute
      const roles = await context.guard.allRoles();
      // assert
      expect(roles.length).toBe(5);
    });

    it('should find roles by name', async () => {
      // setup
      const query = { name: 'admin' };
      // execute
      const roles = await context.guard.findRoles(query);
      // assert
      expect(roles[0].name).toBe('admin');
    });

    it('should find roles by names array, exact match', async () => {
      // setup
      const query = { names: ['admin', 'analyst', 'admin5'] };
      // execute
      const roles = await context.guard.findRoles(query);
      // assert
      expect(roles.length).toBe(2);
    });

    it('should find roles by names array, search mode', async () => {
      // setup
      const query = { names: ['admin', 'mod'], search: true };
      // execute
      const roles = await context.guard.findRoles(query);
      // assert
      expect(roles.length).toBe(3);
    });

    it('should find roles by names with parents', async () => {
      // setup
      const query = { names: ['admin', 'mod'], search: true, withParent: true };
      // execute
      const roles = await context.guard.findRoles(query);
      // assert
      expect(roles.length).toBe(3);
    });

    it('should return all roles when no params passed', async () => {
      // setup
      // execute
      const roles = await context.guard.findRoles();
      // assert
      expect(roles.length).toBe(5);
    });

    it('should return all roles when names array is empty', async () => {
      // setup
      const query = { names: [] };
      // execute
      const roles = await context.guard.findRoles(query);
      // assert
      expect(roles.length).toBe(5);
    });

    it('should get role data by name', async () => {
      // setup
      // execute
      const role = await context.guard.getRole('admin');
      // assert
      expect(role?.name).toBe('admin');
    });

    it('should return null if role not found', async () => {
      // setup
      // execute
      const role = await context.guard.getRole('adminNotFound');
      // assert
      expect(role).toBe(null);
    });
  });

  describe('Delete roles', () => {
    it('should delete single role', async () => {
      // setup
      // execute
      const data = await context.guard.deleteRoles('admin');
      // assert
      expect(data).toBe(1);
    });

    it('should delete multiple roles', async () => {
      // setup
      const roles = ['admin', { name: 'moderator' }];
      // execute
      const data = await context.guard.deleteRoles(roles);
      // assert
      expect(data).toBe(1);
    });

    it('should return 0 if role not found', async () => {
      // setup
      // execute
      const data = await context.guard.deleteRoles('admin3');
      // assert
      expect(data).toBe(0);
    });

    it('should throw error for invalid argument', async () => {
      // setup
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const roles = [3 as any, 'analyst', { name: 'moderator' }];
      // execute & assert
      await expect(context.guard.deleteRoles(roles)).rejects.toThrow();
    });
  });

  describe('Role permissions', () => {
    it('should add permissions to role', async () => {
      // setup
      // execute
      const data = await context.guard.addPermsToRole(
        'analyst',
        ['view'],
        ['*', 'resAnalyst'],
      );
      // assert
      expect(data.permissions.length).toBe(2);
      expect(data.role.name).toBe('analyst');
    });

    it('should remove permissions from role', async () => {
      // setup
      // execute
      const data = await context.guard.rmPermsFromRole(
        'analyst',
        ['view'],
        ['resAnalyst'],
      );
      // assert
      expect(data.permissions.length).toBe(1);
      expect(data.role.name).toBe('analyst');
    });

    it('should handle removing permissions from non-existent role', async () => {
      // setup
      // execute
      const data = await context.guard.rmPermsFromRole(
        'analyst2',
        ['view'],
        ['resAnalyst'],
      );
      // assert
      expect(data.permissions.length).toBe(0);
      expect(data.role.name).toBe('analyst2');
    });
  });
});
