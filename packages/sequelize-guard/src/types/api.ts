import type { GuardPermissionModel, GuardRoleModel } from '../sequelize-models';

/** Plain permission attributes returned by `json: true`. */
export type GuardPermissionData = Pick<
  GuardPermissionModel,
  'id' | 'name' | 'description' | 'resource' | 'action' | 'allow'
>;

/** Result format for literal or dynamic creation options. */
export type GuardCreationResult<
  TOptions,
  TModel,
  TData,
  TDefault = TModel,
> = TOptions extends undefined
  ? TDefault[]
  : 'json' extends keyof TOptions
    ? TOptions extends { json: true }
      ? TData[]
      : TOptions extends { json: false }
        ? TModel[]
        : TModel[] | TData[]
    : TModel[];

/**
 * Result from role creation
 */
export type RoleCreationParam = string | RoleData;

/**
 * Result from role creation
 */
export interface RoleCreationResult {
  role: GuardRoleModel;
  created: boolean;
}

/**
 * Result from adding permissions to role
 */
export interface AddPermsToRoleResult {
  role: GuardRoleModel;
  permissions: GuardPermissionModel[];
}

/**
 * Result from removing permissions from role
 */
export interface RemovePermsFromRoleResult {
  role: GuardRoleModel;
  permissions: GuardPermissionModel[];
  permsRemoved: GuardPermissionModel[];
}

/**
 * Options for creating permissions
 */
export interface CreatePermsOptions {
  name?: string;
  names?: string[];
  all?: boolean;
  json?: boolean;
}

/**
 * Options for creating roles
 */
export interface CreateRolesOptions {
  json?: boolean;
  all?: boolean;
}

/**
 * Arguments for finding roles
 */
export interface FindRolesArgs {
  name?: string;
  names?: string[];
  search?: boolean;
  withParent?: boolean;
}

/**
 * Arguments for finding permissions
 */
export interface FindPermsArgs {
  name?: string;
  resource?: string;
  action?: string;
  search?: boolean;
}

/**
 * Bulk permission creation input
 */
export interface BulkPermissionInput {
  resource: string;
  actions: string | string[];
  name?: string;
}

/**
 * Internal permission data structure
 */
export interface PermissionData {
  name: string;
  resource: string;
  action: string; // JSON stringified array
}

/**
 * Role data structure
 */
export interface RoleData {
  name: string;
  description?: string;
  parent_id?: number;
}

/**
 * Event callback types
 */
export type GuardEventCallback<T> = (data: T) => void;

export type UnsubscribeFn = () => void;
