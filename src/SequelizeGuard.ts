import { EventEmitter } from 'events';
import { merge } from 'lodash';
import type { ModelStatic, Sequelize } from 'sequelize';
import type {
  GuardOptions,
  GuardInternalOptions,
  GuardModels,
  GuardUserModel,
} from './types';
import { defaultOptions } from './constants';
import { initGuardModels } from './models/GuardModels';
import { setupGuardUserAssociations } from './guard/GuardUserAssociations';
import migration from './migrations/guard-migrations';
import seeder from './seeder';

/**
 * SequelizeGuard - Authorization library for Sequelize
 *
 * @example
 * ```typescript
 * const sequelize = new Sequelize(...);
 * const guard = new SequelizeGuard(sequelize, options);
 *
 * // Assign roles
 * await user.assignRole('admin');
 *
 * // Create permissions
 * await guard.allow('admin', ['view', 'edit'], 'blog');
 *
 * // Check permissions
 * const canEdit = await user.can('edit blog');
 * ```
 */
export class SequelizeGuard {
  /** Sequelize instance */
  public readonly sequelize: Sequelize;

  /** Guard configuration options */
  public readonly options: GuardInternalOptions;

  /** Event emitter for guard events */
  private readonly _ee: EventEmitter;

  /** Guard models */
  public _models!: GuardModels;

  /** Cache instance */
  public _cache?: any;

  /** User cache instance */
  public _userCache?: any;

  /**
   * Creates a SequelizeGuard instance
   *
   * @param sequelize - A Sequelize instance
   * @param options - Custom configuration options
   */
  constructor(sequelize: Sequelize, options: GuardOptions = {}) {
    this.sequelize = sequelize;
    this.options = merge({}, defaultOptions, options) as GuardInternalOptions;
    this._ee = new EventEmitter();

    // Attach guard to sequelize instance
    (sequelize as any).guard = this;

    // Initialize models
    this._models = initGuardModels(this);
    (sequelize.models as any).GuardModels = this._models;

    // Setup user associations
    setupGuardUserAssociations(this);

    // Sync models if enabled
    if (this.options.sync) {
      Promise.all(
        Object.values(this._models).map((model) =>
          model.sync({
            logging: this.options.debug ? console.log : false,
          }),
        ),
      ).then(() => {
        this.getCache();
      });
    } else {
      this.getCache();
    }
  }

  /**
   * Get all Guard models
   *
   * @example
   * ```typescript
   * const models = guard.models();
   * ```
   *
   * @returns Array of models used in authorization
   */
  models(): GuardModels {
    return this._models;
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

  /**
   * Migration utilities
   */
  static migration = migration;

  /**
   * Seeder utilities
   */
  static seeder = seeder;
}
