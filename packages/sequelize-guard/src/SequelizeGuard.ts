import type { Model, ModelStatic, Sequelize, SyncOptions } from 'sequelize';
import { captureGuardBindings } from './core/guard-bindings';
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

/** Manage roles, permissions and database-backed authorization for one Sequelize instance. */
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

  /** @internal Reject changed schema routing or model metadata before using bound tables. */
  readonly _assertModelBindings: () => void;

  /**
   * Resolves after automatic sync and cache loading. With sync: false, performs no database work.
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

    this._assertModelBindings = captureGuardBindings(sequelize, [
      this._roleHierarchy,
      ...(Object.values(this._models) as GuardModel[]),
      ...[...this._roleHolders.values()].flatMap(({ members, links }) => [
        members,
        links,
      ]),
    ]);

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
      this._assertModelBindings();
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
        await provisionGuardSchema(
          this.sequelize.getQueryInterface(),
          this.options,
          {
            logging: syncOptions.logging,
            benchmark: syncOptions.benchmark,
          },
        );
      } else if (syncOptions.force) {
        await verifyOwnedGuardTables(
          this.sequelize.getQueryInterface(),
          this.options,
          { logging: syncOptions.logging, useMaster: true },
        );
        await migration.down(
          this.sequelize.getQueryInterface(),
          this.sequelize,
          this.options,
        );
        if (suppliedUser) await suppliedUser.sync(syncOptions);
        await provisionGuardSchema(
          this.sequelize.getQueryInterface(),
          this.options,
          {
            logging: syncOptions.logging,
            benchmark: syncOptions.benchmark,
          },
        );
      }
      for (const model of policyModels) {
        if (model === suppliedUser && (!receipt || syncOptions.force)) continue;
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
   * Get the models bound to this guard.
   * @returns Named model classes, including the supplied or built-in GuardUser.
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
  /**
   * Start a new fluent permission statement.
   * @returns A builder completed by commit().
   */
  declare init: () => GuardControl;
  /**
   * Grant permissions to a role, creating the role if needed.
   * @param role - Role name.
   * @param actions - Action tokens, or `*` for all actions.
   * @param resources - Resource tokens, or `*` for all resources.
   * @param options - Optional outer transaction. Using one suppresses guard events.
   * @returns The role and its current direct permissions.
   */
  declare allow: (
    role: string,
    actions: string | string[],
    resources: string | string[],
    options?: PolicyMutationOptions,
  ) => Promise<AddPermsToRoleResult>;

  // Permission guard methods
  /**
   * Create one permission bundle per resource, reusing matching bundles.
   * @param resources - Resource tokens, or `*` for all resources.
   * @param actions - Action tokens, or `*` for all actions.
   * @param options - Names, result format, existing-row inclusion and optional transaction.
   * @returns New permission models by default; json: true returns plain data.
   */
  declare createPerms: <TOptions extends [options?: CreatePermsOptions]>(
    resources: string | string[],
    actions: string | string[],
    ...options: TOptions
  ) => Promise<
    GuardCreationResult<TOptions[0], GuardPermissionModel, GuardPermissionData>
  >;
  /**
   * Create permission bundles with separate actions and names per resource.
   * @param permissions - Permission bundle definitions.
   * @param options - Default names, result format, existing-row inclusion and optional transaction.
   * @returns New permission models by default; json: true returns plain data.
   */
  declare createPermsBulk: <TOptions extends [options?: CreatePermsOptions]>(
    permissions: BulkPermissionInput[],
    ...options: TOptions
  ) => Promise<
    GuardCreationResult<TOptions[0], GuardPermissionModel, GuardPermissionData>
  >;
  /**
   * Find permissions in the writer database.
   * @param args - Optional filters combined with OR; omitted filters return all permissions.
   * @returns Matching permission models.
   */
  declare findPerms: (args?: FindPermsArgs) => Promise<GuardPermissionModel[]>;
  /**
   * Subscribe to permission creation after commit.
   * Caller-owned transactions emit no events.
   * @param cb - In-process listener receiving new permission models.
   * @returns A function that removes this listener.
   */
  declare onPermsCreated: (
    cb: GuardEventCallback<GuardPermissionModel[]>,
  ) => UnsubscribeFn;
  /**
   * Subscribe to direct permission grants after commit.
   * Caller-owned transactions emit no events.
   * @param cb - In-process listener receiving the role with updated direct permissions.
   * @returns A function that removes this listener.
   */
  declare onPermsAddedToRole: (
    cb: GuardEventCallback<GuardRoleModel>,
  ) => UnsubscribeFn;
  /**
   * Subscribe to direct permission removal after commit.
   * Caller-owned transactions emit no events.
   * @param cb - In-process listener receiving the role with updated direct permissions.
   * @returns A function that removes this listener.
   */
  declare onPermsRemovedFromRole: (
    cb: GuardEventCallback<GuardRoleModel>,
  ) => UnsubscribeFn;
  /** @internal Normalize permission creation input. */
  declare _sanitizePermsInput: (
    resources: string | string[],
    actions: string | string[],
    options?: CreatePermsOptions,
  ) => PermissionData[];

  // Role guard methods
  /**
   * Create a role if its name is not already present.
   * @param role - Role name or attributes.
   * @param options - Optional outer transaction. Using one suppresses guard events.
   * @returns The role model and whether it was created.
   */
  declare makeRole: (
    role: RoleCreationParam,
    options?: PolicyMutationOptions,
  ) => Promise<RoleCreationResult>;
  /**
   * Create roles, reusing existing names.
   * @param roles - Role names or attributes.
   * @param options - Result format, existing-row inclusion and optional transaction.
   * @returns New roles as plain data if options are omitted; explicit options default to models.
   */
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
  /**
   * Delete roles; safeGuardDeletes rejects roles with links or children.
   * @param roles - Role name, names, attributes or models to delete.
   * @param options - Optional outer transaction. Using one suppresses guard events.
   * @returns Number of roles deleted.
   */
  declare deleteRoles: (
    roles: string | RoleCreationParam[] | GuardRoleModel[],
    options?: PolicyMutationOptions,
  ) => Promise<number>;
  /**
   * Set the parent whose permissions a role inherits; cycles are rejected.
   * @param role - Role name.
   * @param parent - Existing parent role name, or null to detach.
   * @param options - Optional outer transaction. Using one suppresses guard events.
   * @returns The updated role model.
   */
  declare setRoleParent: (
    role: string,
    parent: string | null,
    options?: PolicyMutationOptions,
  ) => Promise<GuardRoleModel>;
  /**
   * Read all active roles and their direct permissions from the writer database.
   * @returns Role models with Permissions loaded.
   */
  declare allRoles: () => Promise<GuardRoleModel[]>;
  /**
   * Read a role and its direct permissions from the writer database.
   * @param role - Role name.
   * @returns The role model, or null if absent.
   */
  declare getRole: (role: string) => Promise<GuardRoleModel | null>;
  /**
   * Find active roles in the writer database.
   * @param args - Optional names, substring matching and parent inclusion.
   * @returns Matching role models.
   */
  declare findRoles: (args?: FindRolesArgs) => Promise<GuardRoleModel[]>;
  /**
   * Grant permissions to a role, creating a named role if needed.
   * @param role - Role name or persisted role model.
   * @param actions - Action tokens, or `*` for all actions.
   * @param resources - Resource tokens, or `*` for all resources.
   * @param options - Optional outer transaction. Using one suppresses guard events.
   * @returns The role and its current direct permissions.
   */
  declare addPermsToRole: (
    role: string | GuardRoleModel,
    actions: string | string[],
    resources: string | string[],
    options?: PolicyMutationOptions,
  ) => Promise<AddPermsToRoleResult>;
  /**
   * Remove exact action tokens from direct grants; wildcards do not create deny rules.
   * @param role - Role name.
   * @param actions - Exact action tokens to remove.
   * @param resources - Exact resource tokens to modify.
   * @param options - Optional outer transaction. Using one suppresses guard events.
   * @returns The role, remaining permissions and unlinked bundles.
   */
  declare rmPermsFromRole: (
    role: string,
    actions: string | string[],
    resources: string | string[],
    options?: PolicyMutationOptions,
  ) => Promise<RemovePermsFromRoleResult>;
  /**
   * Subscribe to role creation after commit.
   * Caller-owned transactions emit no events.
   * @param cb - In-process listener receiving new role models.
   * @returns A function that removes this listener.
   */
  declare onRolesCreated: (
    cb: GuardEventCallback<GuardRoleModel[]>,
  ) => UnsubscribeFn;
  /**
   * Subscribe to role deletion after commit.
   * Caller-owned transactions emit no events.
   * @param cb - In-process listener receiving deleted role models.
   * @returns A function that removes this listener.
   */
  declare onRolesDeleted: (
    cb: GuardEventCallback<GuardRoleModel[]>,
  ) => UnsubscribeFn;

  // User guard methods
  /**
   * Create a user without attributes; use models().GuardUser.create for custom fields.
   * @param options - Optional outer transaction. Using one suppresses guard events.
   * @returns The persisted user with guard methods.
   */
  declare makeUser: (
    options?: PolicyMutationOptions,
  ) => Promise<TUser & GuardUserMethods>;
  /**
   * Assign a direct role to a user, restoring an archived assignment if needed.
   * @param user - Persisted guard user.
   * @param role - Role name.
   * @param options - Optional outer transaction. Using one suppresses guard events.
   * @returns The supplied user.
   */
  declare assignRole: <TUser extends Model>(
    user: TUser,
    role: string,
    options?: PolicyMutationOptions,
  ) => Promise<TUser>;
  /**
   * Assign direct roles to a user, restoring archived assignments if needed.
   * @param user - Persisted guard user.
   * @param roles - Direct role names.
   * @param options - Optional outer transaction. Using one suppresses guard events.
   */
  declare assignRoles: (
    user: Model,
    roles: string[],
    options?: PolicyMutationOptions,
  ) => Promise<void>;
  /**
   * Assign every listed role to every listed user atomically.
   * @param users - Persisted guard users.
   * @param roles - Direct role names.
   * @param options - Optional outer transaction. Using one suppresses guard events.
   * @returns A result counting assignments added or reactivated.
   */
  declare assignRolesToUsers: (
    users: readonly Model[],
    roles: readonly string[],
    options?: PolicyMutationOptions,
  ) => Promise<RoleAssignmentResult>;
  /**
   * Assign each user their listed roles atomically.
   * @param assignments - Users and their direct role names.
   * @param options - Optional outer transaction. Using one suppresses guard events.
   * @returns A result counting assignments added or reactivated.
   */
  declare assignUserRoles: (
    assignments: readonly UserRoleAssignment[],
    options?: PolicyMutationOptions,
  ) => Promise<RoleAssignmentResult>;
  /**
   * Remove direct role assignments from a user.
   * @param user - Persisted guard user.
   * @param roles - Direct role names.
   * @param options - Optional outer transaction. Using one suppresses guard events.
   */
  declare rmAssignedRoles: (
    user: Model,
    roles: string[],
    options?: PolicyMutationOptions,
  ) => Promise<void>;
  /**
   * Read active, directly assigned user roles from the writer database.
   * @param user - Persisted guard user.
   * @returns Plain role data; inherited roles are excluded.
   */
  declare getUserRoles: (user: Model) => Promise<GuardRoleData[]>;

  /**
   * Assign direct roles to a registered holder, restoring archived assignments.
   * @param holder - Persisted instance of a registered role-holder model.
   * @param roles - Direct role names.
   * @param options - Optional outer transaction. Using one suppresses guard events.
   * @returns A result counting assignments added or reactivated.
   */
  declare assignRolesToHolder: (
    holder: Model,
    roles: readonly string[],
    options?: PolicyMutationOptions,
  ) => Promise<RoleAssignmentResult>;
  /**
   * Remove direct role assignments from a registered holder.
   * @param holder - Persisted instance of a registered role-holder model.
   * @param roles - Direct role names.
   * @param options - Optional outer transaction. Using one suppresses guard events.
   */
  declare removeRolesFromHolder: (
    holder: Model,
    roles: readonly string[],
    options?: PolicyMutationOptions,
  ) => Promise<void>;
  /**
   * Read active, directly assigned holder roles from the writer database.
   * @param holder - Persisted instance of a registered role-holder model.
   * @returns Plain role data; inherited roles are excluded.
   */
  declare getHolderRoles: (holder: Model) => Promise<GuardRoleData[]>;
  /**
   * Check direct and inherited permissions in the writer database; query errors reject.
   * @param holder - Persisted instance of a registered role-holder model.
   * @param permission - Permission in `action resource` form; `*` means `* *`.
   * @returns Whether access is granted; malformed requests return false.
   */
  declare holderCan: (holder: Model, permission: string) => Promise<boolean>;

  //User permission resolution methods
  /**
   * Check direct and inherited permissions in the writer database; query errors reject.
   * @param user - Persisted guard user.
   * @param permission - Permission in `action resource` form; `*` means `* *`.
   * @returns Whether access is granted; malformed requests return false.
   */
  declare userCan: (user: Model, permission: string) => Promise<boolean>;
  /**
   * Negate userCan; database errors still reject.
   * @param user - Persisted guard user.
   * @param permission - Permission in `action resource` form; `*` means `* *`.
   * @returns Whether access is denied.
   */
  declare userCant: (user: Model, permission: string) => Promise<boolean>;
  /**
   * Match a permission against supplied grants without querying the database.
   * @param givenPermissions - Grants with JSON-encoded action arrays and resource tokens.
   * @param wantedPermission - Permission in `action resource` form, or `*`.
   * @returns Whether a valid grant matches; malformed grants are ignored.
   */
  declare resolvePermission: (
    givenPermissions: { action: string; resource: string }[],
    wantedPermission: string,
  ) => boolean;

  // User role resolution methods
  /**
   * Check whether a user directly holds any listed role.
   * @param user - Persisted guard user.
   * @param roles - Direct role names.
   * @returns Whether any role matches; false for an empty list.
   */
  declare userHasRoles: (user: Model, roles: string[]) => Promise<boolean>;
  /**
   * Check whether a user directly holds every listed role.
   * @param user - Persisted guard user.
   * @param roles - Direct role names.
   * @returns Whether every role matches; true for an empty list.
   */
  declare userHasAllRoles: (user: Model, roles: string[]) => Promise<boolean>;
  /**
   * Check whether a user directly holds a role; inherited roles are excluded.
   * @param user - Persisted guard user.
   * @param role - Role name.
   * @returns Whether the active direct membership exists.
   */
  declare userIsA: (user: Model, role: string) => Promise<boolean>;

  // Cache
  /**
   * Clear the role and permission snapshot; authorization does not use this cache.
   * @returns The empty cache, reloaded on the next getCache() call.
   */
  declare resetCache: () => GuardCache;
  /**
   * Get the role and permission snapshot, loading it if needed.
   * @returns A manual snapshot cache; authorization always reads the database.
   */
  declare getCache: () => Promise<GuardCache>;

  // User cache
  /**
   * Clear the manual user cache; authorization does not use it.
   * @returns The empty cache. Call close() when it is no longer needed.
   */
  declare resetUserCache: () => GuardUserCache;
  /**
   * Get or create the manual user cache; authorization does not use it.
   * @returns The cache. Call close() when it is no longer needed.
   */
  declare getUserCache: () => GuardUserCache;
}

export type SequelizeGuardType = { prototype: SequelizeGuardInstance };

export type SequelizeGuardInstance = SequelizeGuard<Model>;
