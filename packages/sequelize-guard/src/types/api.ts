import type { Model, Transaction } from 'sequelize';
import type { GuardPermissionModel, GuardRoleModel } from '../sequelize-models';

/** Role name or attributes accepted by role creation methods. */
export type RoleCreationParam = string | RoleData;

/** Result from role creation */
export interface RoleCreationResult {
  /** Created or existing role model. */
  role: GuardRoleModel;
  /** True when this operation inserted the role. */
  created: boolean;
}

/** Result from adding permissions to role */
export interface AddPermsToRoleResult {
  /** Role receiving the grants. */
  role: GuardRoleModel;
  /** All active direct permissions after the operation. */
  permissions: GuardPermissionModel[];
}

/** Result from removing permissions from role */
export interface RemovePermsFromRoleResult {
  /** Null when the requested role does not exist. */
  role: GuardRoleModel | null;
  /** Active direct permissions remaining after removal. */
  permissions: GuardPermissionModel[];
  /** Original permission bundles unlinked from the role, including replaced bundles. */
  permsRemoved: GuardPermissionModel[];
}

/** Options for a policy mutation. */
export interface PolicyMutationOptions {
  /**
   * An outermost transaction on the guard's Sequelize instance. Await queries
   * and mutations on this transaction sequentially. The guard uses a savepoint
   * and suppresses its events. Callers own notifications after commit.
   */
  transaction?: Transaction;
}

/** Direct role names to assign to a persisted guard user. */
export interface UserRoleAssignment {
  /** Persisted guard user. */
  readonly user: Model;
  /** Direct role names to assign. */
  readonly roles: readonly string[];
}

/** Count of memberships changed by a bulk role assignment. */
export interface RoleAssignmentResult {
  /** Number of distinct assignments added or reactivated by this operation. */
  assigned: number;
}

/** Options for creating permissions */
export interface CreatePermsOptions extends PolicyMutationOptions {
  /** Name for a single permission bundle; omit to generate a stable name. */
  name?: string;
  /** Names by input position; omitted entries receive generated names. */
  names?: string[];
  /** Include existing matching bundles in the result. Defaults to false. */
  all?: boolean;
  /** Return plain data instead of models. Defaults to false. */
  json?: boolean;
}

/** Options for creating roles */
export interface CreateRolesOptions extends PolicyMutationOptions {
  /** Return plain data. Omitted options use true; an explicit options object defaults to false. */
  json?: boolean;
  /** Include existing matching roles in the result. Defaults to false. */
  all?: boolean;
}

type CreatedRows<TJson, TModel, TData> = TJson extends true
  ? TData[]
  : TModel[];

/** Result for literal or dynamic JSON options, including the omitted-option default. */
export type GuardCreationResult<
  TOptions,
  TModel,
  TData,
  TDefault = TModel,
> = TOptions extends undefined
  ? TDefault[]
  : 'json' extends keyof TOptions
    ? CreatedRows<TOptions['json'], TModel, TData>
    : TModel[];

/** Arguments for finding roles */
export interface FindRolesArgs {
  /** Single role name, used when names is empty or omitted. */
  name?: string;
  /** Role names to match; takes precedence over name. */
  names?: string[];
  /** Use database substring matching instead of exact names. */
  search?: boolean;
  /** Include the immediate Parent association. */
  withParent?: boolean;
}

/** Arguments for finding permissions */
export interface FindPermsArgs {
  /** Permission bundle name. */
  name?: string;
  /** Stored resource token. */
  resource?: string;
  /** Stored JSON action string, not an individual action token. */
  action?: string;
  /** Use database substring matching for each supplied filter. */
  search?: boolean;
}

/** Bulk permission creation input */
export interface BulkPermissionInput {
  /** Resource token, or `*` for all resources. */
  resource: string;
  /** Action tokens, or `*` for all actions. */
  actions: string | string[];
  /** Optional bundle name; otherwise a stable name is generated. */
  name?: string;
}

/** Permission attributes with actions stored as a JSON array string. */
export interface PermissionData {
  /** Permission bundle name. */
  name: string;
  /** Resource token, or `*` for all resources. */
  resource: string;
  /** JSON-encoded array of action tokens. */
  action: string;
}

/** Role data structure */
export interface RoleData {
  /** Role name; surrounding whitespace is trimmed on creation. */
  name: string;
  /** Optional human-readable description. */
  description?: string | null;
  /** Existing parent role ID whose permissions this role inherits. */
  parent_id?: number | null;
}

/** Synchronous listener for an in-process guard event. */
export type GuardEventCallback<T> = (data: T) => void;

/** Remove a previously registered event listener. */
export type UnsubscribeFn = () => void;
