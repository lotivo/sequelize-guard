import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Sequelize } from 'sequelize';
import { SequelizeGuard } from '../index';

describe('SequelizeGuard Basic Tests', () => {
  let sequelize: Sequelize;
  let guard: SequelizeGuard;

  beforeAll(async () => {
    sequelize = new Sequelize('sqlite::memory:', {
      logging: false,
    });

    guard = new SequelizeGuard(sequelize, {
      sync: true,
      debug: false,
    });

    await new Promise((resolve) => setTimeout(resolve, 200));
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('should create a guard instance', () => {
    expect(guard).toBeDefined();
    expect(guard.models()).toBeDefined();
  });

  it('should create a role', async () => {
    const { role, created } = await guard.makeRole('admin');
    expect(role).toBeDefined();
    expect(role.name).toBe('admin');
    expect(created).toBe(true);
  });

  it('should create permissions', async () => {
    const perms = await guard.createPerms('blog', ['view', 'edit']);
    expect(perms).toBeDefined();
    expect(perms.length).toBeGreaterThan(0);
  });

  it('should assign permissions to role', async () => {
    const result = await guard.allow('editor', ['view', 'edit'], 'article');
    expect(result.role).toBeDefined();
    expect(result.permissions).toBeDefined();
  });
});
