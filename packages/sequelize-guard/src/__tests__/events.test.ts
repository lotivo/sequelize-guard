import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDatabase, closeTestDatabase, TestContext } from './setup';

describe('Events', () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await createTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase(context);
  });

  it('should register and listen on onRolesCreated event, remove with returned fn', async () => {
    // setup
    // execute
    const rmCb = context.guard.onRolesCreated((data) => {
      // assert
      expect(data.length).toBe(1);
      rmCb();
      expect(context.guard._ee.listenerCount('onRolesCreated')).toBe(1);
    });
    expect(context.guard._ee.listenerCount('onRolesCreated')).toBe(2);
    await context.guard.makeRole('EventOnRolesCreatedRole');
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
