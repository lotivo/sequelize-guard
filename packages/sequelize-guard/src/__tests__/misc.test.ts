import { Sequelize } from 'sequelize';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SequelizeGuard } from '../index';
import { createTestDatabase, closeTestDatabase, TestContext } from './setup';
import { generateDbPath, cleanupDbFile } from './utils/db-utils';

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
      // setup
      // execute
      const cache = context.guard.resetCache();
      // assert
      expect(cache.stats.keys).toBe(0);
    });

    it('should reset user cache', () => {
      // setup
      // execute
      const cache = context.guard.resetUserCache();
      // assert
      expect(cache.stats.keys).toBe(0);
    });
  });
});

describe('Custom configuration - without user cache', () => {
  let seqMem: Sequelize;
  let guard: SequelizeGuard;
  let dbPath: string;

  beforeAll(async () => {
    dbPath = generateDbPath('test_misc_custom');

    seqMem = new Sequelize({
      dialect: 'sqlite',
      storage: dbPath,
      logging: false,
    });

    guard = new SequelizeGuard(seqMem, {
      sync: true,
      debug: false,
      timestamps: true,
      paranoid: false,
      userCache: false,
    });

    await guard.ready;
  });

  afterAll(async () => {
    await seqMem?.close();
    cleanupDbFile(dbPath);
  });

  it('should work without user cache', async () => {
    // setup
    // execute
    const user = await guard.makeUser();
    const roles = await guard.getUserRoles(user);
    // assert
    expect(Array.isArray(roles)).toBe(true);
  });
});
