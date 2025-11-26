import { EventEmitter } from 'events';
import { merge } from 'lodash';
import { defaultOptions } from '../constants';
import { GuardInternalOptions, GuardOptions } from '../types';
import { GuardCache } from '../utils/cache';
import { GuardUserCache } from '../utils/userCache';

export abstract class SequelizeGuardBase {
  /** Guard configuration options */
  public readonly options: GuardInternalOptions;

  /**
   * @internal
   * Event emitter for guard events - internal use only
   */
  public readonly _ee: EventEmitter;

  /**
   * @internal
   * Cache instance - internal use only
   */
  public _cache?: GuardCache;

  /**
   * @internal
   * User cache instance - internal use only
   */
  public _userCache?: GuardUserCache;

  constructor(options: GuardOptions = {}) {
    this.options = merge({}, defaultOptions, options) as GuardInternalOptions;
    this._ee = new EventEmitter();
  }

  /**
   * Subscribe to an event
   * @param name
   * @param fn
   * @internal
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(name: string, cb: (...args: any[]) => void): () => void {
    this._ee.on(name, cb);
    return () => this._ee.off(name, cb);
  }

  /**
   * Subscribe to an event once
   * @param name
   * @param fn
   * @internal
   */
  once(
    name: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cb: (...args: any[]) => void,
  ): () => void {
    this._ee.once(name, cb);
    return () => this._ee.off(name, cb);
  }

  /**
   * Emit an event
   * @param name
   * @param {...any} args
   * @internal
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  emit(name: string, ...args: any[]): void {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    this._ee.emit(name, ...args);
  }
}
