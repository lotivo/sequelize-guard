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

  it('delivers a once subscription exactly once', () => {
    const listener = vi.fn();
    context.guard.once('someEvent', listener);
    context.guard.emit('someEvent', ['first']);
    context.guard.emit('someEvent', ['second']);
    expect(listener).toHaveBeenCalledExactlyOnceWith(['first']);
  });

  it('cancels a once subscription before its first event', () => {
    const listener = vi.fn();
    const unsubscribe = context.guard.once('someEvent', listener);
    unsubscribe();
    context.guard.emit('someEvent', ['first']);
    expect(listener).not.toHaveBeenCalled();
  });
});
