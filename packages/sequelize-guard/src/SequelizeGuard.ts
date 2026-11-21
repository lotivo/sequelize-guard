import type { Sequelize, SyncOptions } from 'sequelize';
import { SequelizeGuardBase } from './core/SequelizeGuardBase';
import type { GuardControl } from './guard/GuardControl';
import { setupGuardUserAssociations } from './guard/GuardUserAssociations';
import migration from './migrations/guard-migrations';
import type {
  GuardModel,
  GuardPermissionModel,
  GuardRoleData,
  GuardRoleModel,
  GuardUserModel,
} from './sequelize-models';
import { GuardModels, initGuardModels } from './sequelize-models';
import { GuardOptions } from './types';
import type {
  AddPermsToRoleResult,
  BulkPermissionInput,
  CreatePermsOptions,
  CreateRolesOptions,
  FindPermsArgs,
  FindRolesArgs,
  GuardCreationResult,
  GuardEventCallback,
  GuardPermissionData,
  PermissionData,
  RemovePermsFromRoleResult,
  RoleCreationParam,
  RoleCreationResult,
  UnsubscribeFn,
} from './types/api';
import { SequelizeWithGuard } from './types/helpers';
import type { GuardCache } from './utils/cache';
import type { GuardUserCache } from './utils/userCache';

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
   * Automatic startup completion, including model sync and cache initialization.
   * With sync: false, resolves without database work; await sync() separately
   * or prepare the tables with migrations before using the guard.
   * @example
   * ```typescript
   * const guard = new SequelizeGuard(sequelize, { sync: true });
   * await guard.ready;
   * // Now safe to use guard
   * ```
   */
  public readonly ready: Promise<void>;

  private syncTask: Promise<void> = Promise.resolve();

  /**
   * Creates a SequelizeGuard instance
   * @param sequelize - A Sequelize instance
   * @param options - Custom configuration options
   */
  constructor(sequelize: Sequelize, options: GuardOptions = {}) {
    super(options);

    this.sequelize = sequelize as SequelizeWithGuard;

    // Initialize models
    this._models = initGuardModels(this);

    // Attach guard to sequelize instance
    this.sequelize.guard = this;
    this.sequelize.models.GuardModels = this._models;

    // Setup user associations
    this.sequelize.models.User = setupGuardUserAssociations(this);

    this.ready = this.options.sync
      ? this.sync().then(() => undefined)
      : Promise.resolve();
  }

  /**
   * Synchronize guard models, then reload their cached roles and permissions.
   * Calls are serialized, including automatic startup. Errors reject the caller.
   * Includes a supplied UserModel; unrelated Sequelize models are not synced.
   * schema must match every model's bound schema; per-call searchPath is rejected.
   * @param options - Sequelize sync options. force and alter may destroy data.
   * @returns This guard after synchronization and cache initialization complete.
   */
  sync(options: SyncOptions = {}): Promise<this> {
    const syncOptions = {
      logging: this.options.debug ? console.log : false,
      ...options,
    };
    const task = this.syncTask.then(async () => {
      if (
        syncOptions.match &&
        !syncOptions.match.test(this.sequelize.getDatabaseName())
      ) {
        throw new Error(
          `Database "${this.sequelize.getDatabaseName()}" does not match sync match parameter "${syncOptions.match}"`,
        );
      }

      if (syncOptions.searchPath !== undefined) {
        throw new Error(
          'sync searchPath overrides are not supported; configure schema routing on Sequelize before constructing the guard',
        );
      }
      const models: GuardModel[] = Object.values(this._models);
      // Model.sync can create in a new schema while drop/index queries use the old one.
      if (
        syncOptions.schema !== undefined &&
        models.some((model) => {
          const table = model.getTableName();
          return (
            typeof table === 'string' || table.schema !== syncOptions.schema
          );
        })
      ) {
        throw new Error(
          'sync schema must match the schema already bound to every guard model',
        );
      }
      // Drop junction tables before the tables they reference.
      if (syncOptions.force) {
        for (const model of [...models].reverse())
          await model.drop(syncOptions);
      }
      for (const model of models) await model.sync(syncOptions);
      this.resetCache();
      await this.getCache();
      return this;
    });
    // A failed caller must not prevent a later explicit retry.
    this.syncTask = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
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

  // Implementations are installed on the prototype by the package entry point.
  // init
  declare init: () => GuardControl;
  declare allow: (
    role: string,
    actions: string | string[],
    resources: string | string[],
  ) => Promise<AddPermsToRoleResult>;

  // Permission guard methods
  /** Create permission bundles. `json: true` returns plain data. */
  declare createPerms: <TOptions extends [options?: CreatePermsOptions]>(
    resources: string | string[],
    actions: string | string[],
    ...options: TOptions
  ) => Promise<
    GuardCreationResult<TOptions[0], GuardPermissionModel, GuardPermissionData>
  >;
  /** Create bundles with separate resources and actions. `json: true` returns plain data. */
  declare createPermsBulk: <TOptions extends [options?: CreatePermsOptions]>(
    permissions: BulkPermissionInput[],
    ...options: TOptions
  ) => Promise<
    GuardCreationResult<TOptions[0], GuardPermissionModel, GuardPermissionData>
  >;
  declare findPerms: (args?: FindPermsArgs) => Promise<GuardPermissionModel[]>;
  declare onPermsCreated: (
    cb: GuardEventCallback<GuardPermissionModel[]>,
  ) => UnsubscribeFn;
  declare onPermsAddedToRole: (
    cb: GuardEventCallback<GuardRoleModel>,
  ) => UnsubscribeFn;
  declare onPermsRemovedFromRole: (
    cb: GuardEventCallback<GuardRoleModel>,
  ) => UnsubscribeFn;
  declare _sanitizePermsInput: (
    resources: string | string[],
    actions: string | string[],
    options?: CreatePermsOptions,
  ) => PermissionData[];

  // Role guard methods
  declare makeRole: (role: RoleCreationParam) => Promise<RoleCreationResult>;
  /** Create roles. Omitted options return plain data; explicit options default to models. */
  declare makeRoles: <TOptions extends [options?: CreateRolesOptions]>(
    roles: RoleCreationParam[],
    ...options: TOptions
  ) => Promise<
    GuardCreationResult<
      TOptions[0],
      GuardRoleModel,
      GuardRoleData,
      GuardRoleData
    >
  >;
  declare deleteRoles: (
    roles: string | RoleCreationParam[] | GuardRoleModel[],
  ) => Promise<number>;
  declare allRoles: () => Promise<GuardRoleModel[]>;
  declare getRole: (role: string) => Promise<GuardRoleModel | null>;
  declare findRoles: (args?: FindRolesArgs) => Promise<GuardRoleModel[]>;
  declare addPermsToRole: (
    role: string | GuardRoleModel,
    actions: string | string[],
    resources: string | string[],
  ) => Promise<AddPermsToRoleResult>;
  declare rmPermsFromRole: (
    role: string,
    actions: string | string[],
    resources: string | string[],
  ) => Promise<RemovePermsFromRoleResult>;
  declare onRolesCreated: (
    cb: GuardEventCallback<GuardRoleModel[]>,
  ) => UnsubscribeFn;
  declare onRolesDeleted: (
    cb: GuardEventCallback<GuardRoleModel[]>,
  ) => UnsubscribeFn;

  // User guard methods
  declare makeUser: () => Promise<GuardUserModel>;
  declare assignRole: (
    user: GuardUserModel,
    role: string,
  ) => Promise<GuardUserModel>;
  declare assignRoles: (user: GuardUserModel, roles: string[]) => Promise<void>;
  declare rmAssignedRoles: (
    user: GuardUserModel,
    roles: string[],
  ) => Promise<void>;
  declare getUserRoles: (user: GuardUserModel) => Promise<GuardRoleData[]>;

  //User permission resolution methods
  declare userCan: (
    user: GuardUserModel,
    permission: string,
  ) => Promise<boolean>;
  declare userCant: (
    user: GuardUserModel,
    permission: string,
  ) => Promise<boolean>;
  declare resolvePermission: (
    givenPermissions: { action: string; resource: string }[],
    wantedPermission: string,
  ) => boolean;

  // User role resolution methods
  declare userHasRoles: (
    user: GuardUserModel,
    roles: string[],
  ) => Promise<boolean>;
  declare userHasAllRoles: (
    user: GuardUserModel,
    roles: string[],
  ) => Promise<boolean>;
  declare userIsA: (user: GuardUserModel, role: string) => Promise<boolean>;

  // Cache
  declare resetCache: () => GuardCache;
  declare getCache: () => Promise<GuardCache>;

  // User cache
  declare resetUserCache: () => GuardUserCache;
  declare getUserCache: () => GuardUserCache;
}

export type SequelizeGuardType = typeof SequelizeGuard;
