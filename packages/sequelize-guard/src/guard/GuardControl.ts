import type { SequelizeGuardInstance } from '../SequelizeGuard';
import type { AddPermsToRoleResult, PolicyMutationOptions } from '../types';
import { canonicalPermissionActions, permissionResources } from './Permissions';
import { normalizeRoleName } from './Roles';

/** Build one role permission statement and persist it with commit(). */
export class GuardControl {
  private guard: SequelizeGuardInstance;
  _roles: string;
  _actions: string[];
  _resources: string[];

  /**
   * Create a permission statement for a guard.
   * @param guard - Guard used to persist the statement.
   */
  constructor(guard: SequelizeGuardInstance) {
    this.guard = guard;
    this._roles = '';
    this._actions = [];
    this._resources = [];
  }

  /**
   * Select the role receiving permissions.
   * @param roles - Role name; created on commit if absent.
   * @returns This builder.
   */
  allow(roles: string): this {
    this._roles = normalizeRoleName(roles);
    return this;
  }

  /**
   * Add actions to this statement.
   * @param actions - Action tokens, or `*` for all actions.
   * @returns This builder.
   */
  to(actions: string | string[]): this {
    this._actions = [
      ...new Set([...this._actions, ...canonicalPermissionActions(actions)]),
    ];
    return this;
  }

  /**
   * Add resources to this statement.
   * @param resources - Resource tokens, or `*` for all resources.
   * @returns This builder.
   */
  on(resources: string | string[]): this {
    this._resources = [
      ...new Set([...this._resources, ...permissionResources(resources)]),
    ];
    return this;
  }

  /**
   * Save the complete statement, clearing it before persistence even if saving fails.
   * @param options - Optional outer transaction. Using one suppresses guard events.
   * @returns The role and its current direct permissions.
   */
  async commit(options?: PolicyMutationOptions): Promise<AddPermsToRoleResult> {
    const role = normalizeRoleName(this._roles);
    const actions = canonicalPermissionActions(this._actions);
    const resources = permissionResources(this._resources);
    this._roles = '';
    this._actions = [];
    this._resources = [];

    return this.guard.addPermsToRole(role, actions, resources, options);
  }
}
