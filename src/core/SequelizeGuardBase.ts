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
   * @internal
   */
  on(name: string, fn: (...args: any[]) => void): () => void {
    this._ee.on(name, fn);
    return () => this._ee.off(name, fn);
  }

  /**
   * Subscribe to an event once
   * @internal
   */
  once(name: string, fn: (...args: any[]) => void): () => void {
    this._ee.once(name, fn);
    return () => this._ee.off(name, fn);
  }

  /**
   * Emit an event
   * @internal
   */
  emit(name: string, ...args: any[]): void {
    this._ee.emit(name, ...args);
  }
}
