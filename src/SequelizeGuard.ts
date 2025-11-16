import type { Sequelize } from 'sequelize';
import { SequelizeGuardBase } from './core/SequelizeGuardBase';
import { setupGuardUserAssociations } from './guard/GuardUserAssociations';
import migration from './migrations/guard-migrations';
import { GuardModel, GuardModels, initGuardModels } from './sequelize-models';
import type { GuardOptions } from './types';
import { SequelizeWithGuard } from './types/helpers';

/**
 * SequelizeGuard - Authorization library for Sequelize
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
export class SequelizeGuard extends SequelizeGuardBase {
  /** Sequelize instance */
  public readonly sequelize: SequelizeWithGuard;

  /**
   * @internal
   * Guard models - internal use only
   */
  public _models!: GuardModels;

  /**
   * Creates a SequelizeGuard instance
   * @param sequelize - A Sequelize instance
   * @param options - Custom configuration options
   */
  constructor(sequelize: Sequelize, options: GuardOptions = {}) {
    super(options);

    this.sequelize = sequelize as SequelizeWithGuard<Sequelize, GuardOptions>;

    // Initialize models
    this._models = initGuardModels(this);

    // Attach guard to sequelize instance
    this.sequelize.guard = this;
    this.sequelize.models.GuardModels = this._models;
    // Setup user associations
    this.sequelize.models.User = setupGuardUserAssociations(this);

    // Sync models if enabled
    if (this.options.sync) {
      Promise.all(
        Object.values(this._models).map((model: GuardModel) =>
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
   * @example
   * ```typescript
   * const models = guard.models();
   * ```
   * @returns Array of models used in authorization
   */
  models(): GuardModels {
    return this._models;
  }

  /**
   * Migration utilities
   */
  static migration = migration;
}

export type SequelizeGuardType = typeof SequelizeGuard;
