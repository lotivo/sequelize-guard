import type { Model, ModelStatic } from 'sequelize';

/**
 * Configuration options for SequelizeGuard
 */
export interface GuardOptions<TUser extends Model = Model> {
  /**
   * Table suffixes. Each name is prefixed with `prefix`. A supplied UserModel
   * determines its own table.
   */
  tables?: {
    /** @deprecated Reserved for compatibility. */
    meta?: string;
    /** @deprecated Reserved for compatibility. */
    parents?: string;
    permissions?: string;
    resources?: string;
    roles?: string;
    role_permission?: string;
    role_user?: string;
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
  primaryKey?: 'id';

  /**
   * Add timestamps to tables
   * @default false
   */
  timestamps?: boolean;

  /**
   * Enable soft deletes when timestamps are enabled
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
   * Model used for User (pass model, not string name)
   * @default null
   */
  UserModel?: ModelStatic<TUser> | null;

  /**
   * Application model classes keyed by a stable role holder type.
   * Types use lower-case ASCII letters, digits, and underscores, starting
   * with a letter. Each model must have a single supported primary key.
   */
  roleHolders?: Readonly<Record<string, ModelStatic<Model>>>;

  /**
   * Attribute or physical column name of the user model's single primary key.
   * Defaults to the supplied model's primary key, or `id` for the built-in model.
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
export interface GuardInternalOptions
  extends Required<Omit<GuardOptions, 'userPk'>> {
  tables: NonNullable<GuardOptions['tables']>;
  userPk: string | undefined;
}
