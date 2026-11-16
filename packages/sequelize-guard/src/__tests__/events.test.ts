import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createTestDatabase, closeTestDatabase, TestContext } from './setup';

describe('Events', () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await createTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase(context);
  });

  it('delivers committed role models and stops notifying an unsubscribed listener', async () => {
    const listener = vi.fn();
    const unsubscribe = context.guard.onRolesCreated(listener);
    const result = await context.guard
      .init()
      .allow('events-reader')
      .to('read')
      .on('article')
      .commit();

    expect(listener).toHaveBeenCalledExactlyOnceWith([result.role]);
    expect(result.role).toBeInstanceOf(context.guard.models().GuardRole);
    unsubscribe();
    await context.guard.makeRole('events-writer');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('should register and listen on someEvent event, removed AFTER one call', () => {
    // setup
    // execute
    context.guard.once('someEvent', (data) => {
      // assert
      expect(data.length).toBe(1);
      expect(context.guard._ee.listenerCount('someEvent')).toBe(0);
    });
    expect(context.guard._ee.listenerCount('someEvent')).toBe(1);
    context.guard._ee.emit('someEvent', ['a']);
  });

  it('should register and listen on someEvent event, removed BEFORE one call', () => {
    // setup
    // execute
    const cb = context.guard.once('someEvent', (data) => {
      // assert
      expect(data).toBeUndefined();
    });
    expect(context.guard._ee.listenerCount('someEvent')).toBe(1);
    cb();
    expect(context.guard._ee.listenerCount('someEvent')).toBe(0);
    context.guard._ee.emit('someEvent', ['a']);
  });
});
