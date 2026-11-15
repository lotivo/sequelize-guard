import type { Transaction } from 'sequelize';
import type { GuardPermissionModel, GuardRoleModel } from '../sequelize-models';

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
  /** Null when the requested role does not exist. */
  role: GuardRoleModel | null;
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

/**
 * Options for creating permissions
 */
export interface CreatePermsOptions extends PolicyMutationOptions {
  name?: string;
  names?: string[];
  all?: boolean;
  json?: boolean;
}

/**
 * Options for creating roles
 */
export interface CreateRolesOptions extends PolicyMutationOptions {
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
  parent_id?: number | null;
}

/**
 * Event callback types
 */
export type GuardEventCallback<T> = (data: T) => void;

export type UnsubscribeFn = () => void;
