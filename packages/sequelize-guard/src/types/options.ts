import type { ModelStatic } from 'sequelize';
import { GuardUserModel } from '../sequelize-models';

/**
 * Configuration options for SequelizeGuard
 */
export interface GuardOptions {
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
   * Auto create tables, set to false if using migrations
   * @default true
   */
  sync?: boolean;

  /**
   * Debug mode, output logs
   * @default false
   */
  debug?: boolean;

  /**
   * Model used for User (pass model, not string name)
   * @default null
   */
  UserModel?: ModelStatic<GuardUserModel> | null;

  /**
   * Primary key used for User Model
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
export interface GuardInternalOptions extends Required<GuardOptions> {
  tables: Required<NonNullable<GuardOptions['tables']>>;
}
