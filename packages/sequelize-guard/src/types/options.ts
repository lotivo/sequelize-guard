import type { Model, ModelStatic } from 'sequelize';
import type { GuardUserModel } from '../sequelize-models';

/**
 * Configuration options for SequelizeGuard
 */
export interface GuardOptions<TUser extends Model = GuardUserModel> {
  /**
   * Table names configuration
   */
  tables?: {
    meta?: string;
    parents?: string;
    permissions?: string;
    resources?: string;
    roles?: string;
    users?: string;
  };

  /**
   * Prefix for guard tables in database
   * @default 'guard_'
   */
  prefix?: string;

  /**
   * Primary key for guard tables
   * @default 'id'
   */
  primaryKey?: string;

  /**
   * Add timestamps to tables
   * @default false
   */
  timestamps?: boolean;

  /**
   * Enable soft deletes of items
   * @default false
   */
  paranoid?: boolean;

  /**
   * Auto sync tables and initialize the cache; await guard.ready for completion.
   * Set false to defer database work to guard.sync(options) or use migrations.
   * @default true
   */
  sync?: boolean;

  /**
   * Debug mode, output logs
   * @default false
   */
  debug?: boolean;

  /**
   * Initialized application user model on the same Sequelize instance.
   * @default null
   */
  UserModel?: ModelStatic<TUser> | null;

  /**
   * Attribute or column name of the supplied UserModel's single primary key.
   * Omit to use its declared primary key; the built-in user uses `id`.
   * @default 'id'
   */
  userPk?: string;

  /**
   * Roles or permissions can't be deleted while associated with other data
   * @default true
   */
  safeGuardDeletes?: boolean;

  /**
   * @deprecated Authorization and getUserRoles always read the database.
   * Retained for configuration compatibility; does not enable authorization caching.
   * @default true
   */
  userCache?: boolean;

  /**
   * TTL for entries manually stored in getUserCache() (in seconds).
   * Authorization does not read this cache.
   * @default 60
   */
  userCacheTtl?: number;
}

/**
 * Internal options with all defaults applied
 */
export interface GuardInternalOptions extends Required<GuardOptions<Model>> {
  tables: Required<NonNullable<GuardOptions<Model>['tables']>>;
}
