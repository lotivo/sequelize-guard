import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Sequelize } from 'sequelize';
import { SequelizeGuard } from '../index';
import { createTestDatabase, closeTestDatabase, TestContext } from './setup';

describe('Miscellaneous', () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await createTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase(context);
  });

  describe('Cache operations', () => {
    it('should reset cache', () => {
      const cache = context.guard.resetCache();
      expect(cache.stats.keys).toBe(0);
    });

    it('should reset user cache', () => {
      const cache = context.guard.resetUserCache();
      expect(cache.stats.keys).toBe(0);
    });
  });
});

describe('Custom configuration - without user cache', () => {
  let seqMem: Sequelize;
  let guard: SequelizeGuard;

  beforeAll(async () => {
    seqMem = new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
    });

    guard = new SequelizeGuard(seqMem, {
      sync: true,
      debug: false,
      timestamps: true,
      paranoid: false,
      userCache: false,
    });

    await new Promise((resolve) => setTimeout(resolve, 200));
  });

  afterAll(async () => {
    await seqMem?.close();
  });

  it('should work without user cache', async () => {
    const user = await guard.makeUser({
      name: 'SuperAdmin',
      email: 'superadmin@test.com',
    });
    const roles = await guard.getUserRoles(user);
    expect(Array.isArray(roles)).toBe(true);
  });
});
