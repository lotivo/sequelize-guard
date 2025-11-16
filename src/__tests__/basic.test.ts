import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Sequelize } from 'sequelize';
import { SequelizeGuard } from '../index';
import { generateDbPath, cleanupDbFile } from './utils/db-utils';

describe('SequelizeGuard Basic Tests', () => {
  let sequelize: Sequelize;
  let guard: SequelizeGuard;
  let dbPath: string;

  beforeAll(async () => {
    dbPath = generateDbPath('test_basic');

    sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: dbPath,
      logging: false,
    });

    guard = new SequelizeGuard(sequelize, {
      sync: true,
      debug: false,
    });

    await guard.ready;
  });

  afterAll(async () => {
    await sequelize.close();
    cleanupDbFile(dbPath);
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
