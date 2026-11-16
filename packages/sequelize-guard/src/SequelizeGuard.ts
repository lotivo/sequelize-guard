import type { Model, ModelStatic, Sequelize, SyncOptions } from 'sequelize';
import { SequelizeGuardBase } from './core/SequelizeGuardBase';
import type { GuardControl } from './guard/GuardControl';
import {
  assertGuardUserAssociations,
  guardUserMethods,
} from './guard/GuardUserAssociations';
import migration, {
  provisionGuardSchema,
  verifyOwnedGuardTables,
} from './migrations/guard-migrations';
import {
  assertOwnedOrEmptySchema,
  guardOwnership,
  ownershipPattern,
} from './migrations/guard-ownership';
import type {
  GuardModel,
  GuardPermissionData,
  GuardPermissionModel,
  GuardRoleData,
  GuardRoleModel,
  GuardUserMethods,
  GuardUserModel,
} from './sequelize-models';
import { GuardModels, initGuardModels } from './sequelize-models';
import {
  assertAvailableHolderModelNames,
  assertRoleHolderTables,
  initRoleHolders,
  roleHolderTables,
} from './sequelize-models/guard-role-holders';
import {
  assertGuardSchema,
  assertNoLegacyTableNames,
} from './sequelize-models/guard-tables';
import { initRoleHierarchy } from './sequelize-models/GuardRoleHierarchy';
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
  PermissionData,
  PolicyMutationOptions,
  RemovePermsFromRoleResult,
  RoleAssignmentResult,
  RoleCreationParam,
  RoleCreationResult,
  UnsubscribeFn,
  UserRoleAssignment,
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
export class SequelizeGuard<
  TUser extends Model = GuardUserModel,
> extends SequelizeGuardBase {
  /** Sequelize instance */
  public readonly sequelize: SequelizeWithGuard<TUser>;

  /**
   * @internal
   * Guard models - internal use only
   */
  public _models!: GuardModels<Model>;

  /** @internal Transaction lock for hierarchy changes. */
  readonly _roleHierarchy: ReturnType<typeof initRoleHierarchy>;

  /** @internal Binding between the initialized schema and its principal model. */
  readonly _ownershipPattern: string;

  /** @internal Registered application principals and their junction models. */
  readonly _roleHolders: ReturnType<typeof initRoleHolders>;

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
  constructor(
    sequelize: Sequelize,
    ...[options]: [options?: GuardOptions<TUser>] &
      (GuardUserModel extends TUser
        ? unknown
        : [options: { UserModel: ModelStatic<TUser> }])
  ) {
    super(options);

    if ('guard' in sequelize) {
      throw new Error('This Sequelize instance already has a guard');
    }
    this.sequelize = sequelize as SequelizeWithGuard<TUser>;
    if ('GuardModels' in sequelize.models) {
      throw new Error('Sequelize model registry already defines "GuardModels"');
    }

    const { UserModel } = this.options;
    const userMethods = guardUserMethods(this);
    if (UserModel) {
      if (sequelize.models[UserModel.name] !== UserModel) {
        throw new Error(
          'UserModel must be registered on this Sequelize instance',
        );
      }
      assertGuardUserAssociations(UserModel, userMethods);
    }

    this._ownershipPattern = ownershipPattern(
      guardOwnership(sequelize, this.options),
    );

    const holders = roleHolderTables(sequelize, this.options);
    assertAvailableHolderModelNames(sequelize, holders);

    this._models = initGuardModels(this);
    this._roleHierarchy = initRoleHierarchy(this);
    this._roleHolders = initRoleHolders(sequelize, this.options, holders);
    Object.assign(this._models.GuardUser.prototype, userMethods);

    this.sequelize.guard = this;
    this.sequelize.models.GuardModels = this.models();
    sequelize.models.User ??= this._models.GuardUser;

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
      const holders = [...this._roleHolders.values()];
      const models = [
        this._roleHierarchy,
        ...(Object.values(this._models) as GuardModel[]),
        ...holders.map(({ links }) => links),
      ];
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
      await assertGuardSchema(this.sequelize, this.options, syncOptions);
      await assertNoLegacyTableNames(this.sequelize, this.options, syncOptions);
      await assertRoleHolderTables(
        this.sequelize,
        holders.map(({ members }) => members),
        syncOptions,
      );
      const receipt = await assertOwnedOrEmptySchema(
        this.sequelize,
        this.options,
        syncOptions,
      );
      // Drop junction tables before the tables they reference.
      const policyModels = models.slice(1);
      const suppliedUser = this.options.UserModel;
      const requestedSync = syncOptions.force
        ? { ...syncOptions, force: false }
        : syncOptions;
      if (!receipt) {
        if (suppliedUser) await this._models.GuardUser.sync(syncOptions);
        await provisionGuardSchema(this.sequelize.getQueryInterface(), this.options, {
          logging: syncOptions.logging,
          benchmark: syncOptions.benchmark,
        });
      } else if (syncOptions.force) {
        await verifyOwnedGuardTables(
          this.sequelize.getQueryInterface(),
          this.options,
          { logging: syncOptions.logging, useMaster: true },
        );
        for (const model of [...policyModels].reverse()) {
          if (model !== suppliedUser) await model.drop(requestedSync);
        }
      }
      for (const model of policyModels) {
        if (model === suppliedUser && !receipt) continue;
        await model.sync(model === suppliedUser ? syncOptions : requestedSync);
      }
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
  models(): GuardModels<TUser> {
    // The constructor registers the exact supplied model before adding guard methods.
    return this._models as GuardModels<TUser>;
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
    options?: PolicyMutationOptions,
  ) => Promise<AddPermsToRoleResult>;

  // Permission guard methods
  declare createPerms: <TOptions extends [options?: CreatePermsOptions]>(
    resources: string | string[],
    actions: string | string[],
    ...options: TOptions
  ) => Promise<
    GuardCreationResult<TOptions[0], GuardPermissionModel, GuardPermissionData>
  >;
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
  declare makeRole: (
    role: RoleCreationParam,
    options?: PolicyMutationOptions,
  ) => Promise<RoleCreationResult>;
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
    options?: PolicyMutationOptions,
  ) => Promise<number>;
  declare setRoleParent: (
    role: string,
    parent: string | null,
    options?: PolicyMutationOptions,
  ) => Promise<GuardRoleModel>;
  declare allRoles: () => Promise<GuardRoleModel[]>;
  declare getRole: (role: string) => Promise<GuardRoleModel | null>;
  declare findRoles: (args?: FindRolesArgs) => Promise<GuardRoleModel[]>;
  declare addPermsToRole: (
    role: string | GuardRoleModel,
    actions: string | string[],
    resources: string | string[],
    options?: PolicyMutationOptions,
  ) => Promise<AddPermsToRoleResult>;
  declare rmPermsFromRole: (
    role: string,
    actions: string | string[],
    resources: string | string[],
    options?: PolicyMutationOptions,
  ) => Promise<RemovePermsFromRoleResult>;
  declare onRolesCreated: (
    cb: GuardEventCallback<GuardRoleModel[]>,
  ) => UnsubscribeFn;
  declare onRolesDeleted: (
    cb: GuardEventCallback<GuardRoleModel[]>,
  ) => UnsubscribeFn;

  // User guard methods
  declare makeUser: (
    options?: PolicyMutationOptions,
  ) => Promise<TUser & GuardUserMethods>;
  declare assignRole: <TUser extends Model>(
    user: TUser,
    role: string,
    options?: PolicyMutationOptions,
  ) => Promise<TUser>;
  declare assignRoles: (
    user: Model,
    roles: string[],
    options?: PolicyMutationOptions,
  ) => Promise<void>;
  declare assignRolesToUsers: (
    users: readonly Model[],
    roles: readonly string[],
    options?: PolicyMutationOptions,
  ) => Promise<RoleAssignmentResult>;
  declare assignUserRoles: (
    assignments: readonly UserRoleAssignment[],
    options?: PolicyMutationOptions,
  ) => Promise<RoleAssignmentResult>;
  declare rmAssignedRoles: (
    user: Model,
    roles: string[],
    options?: PolicyMutationOptions,
  ) => Promise<void>;
  declare getUserRoles: (user: Model) => Promise<GuardRoleData[]>;

  declare assignRolesToHolder: (
    holder: Model,
    roles: readonly string[],
    options?: PolicyMutationOptions,
  ) => Promise<RoleAssignmentResult>;
  declare removeRolesFromHolder: (
    holder: Model,
    roles: readonly string[],
    options?: PolicyMutationOptions,
  ) => Promise<void>;
  declare getHolderRoles: (holder: Model) => Promise<GuardRoleData[]>;
  declare holderCan: (holder: Model, permission: string) => Promise<boolean>;

  //User permission resolution methods
  declare userCan: (user: Model, permission: string) => Promise<boolean>;
  declare userCant: (user: Model, permission: string) => Promise<boolean>;
  declare resolvePermission: (
    givenPermissions: { action: string; resource: string }[],
    wantedPermission: string,
  ) => boolean;

  // User role resolution methods
  declare userHasRoles: (user: Model, roles: string[]) => Promise<boolean>;
  declare userHasAllRoles: (user: Model, roles: string[]) => Promise<boolean>;
  declare userIsA: (user: Model, role: string) => Promise<boolean>;

  // Cache
  declare resetCache: () => GuardCache;
  declare getCache: () => Promise<GuardCache>;

  // User cache
  declare resetUserCache: () => GuardUserCache;
  declare getUserCache: () => GuardUserCache;
}

export type SequelizeGuardType = { prototype: SequelizeGuardInstance };

export type SequelizeGuardInstance = SequelizeGuard<Model>;
