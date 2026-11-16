import type { SequelizeGuardInstance } from '../SequelizeGuard';
import type { AddPermsToRoleResult, PolicyMutationOptions } from '../types';
import { canonicalPermissionActions, permissionResources } from './Permissions';
import { normalizeRoleName } from './Roles';

/**
 * GuardControl - Fluent API for creating guard statements
 * @example
 * ```typescript
 * guard.init()
 *   .allow('admin')
 *   .to(['view', 'edit'])
 *   .on('blog')
 *   .commit();
 * ```
 */
export class GuardControl {
  private guard: SequelizeGuardInstance;
  _roles: string;
  _actions: string[];
  _resources: string[];

  constructor(guard: SequelizeGuardInstance) {
    this.guard = guard;
    this._roles = '';
    this._actions = [];
    this._resources = [];
  }

  /**
   * Specify role to allow
   * @param roles - The name of role
   * @returns This GuardControl instance for chaining
   * @example
   * ```typescript
   * control.allow('admin')
   * ```
   */
  allow(roles: string): this {
    this._roles = normalizeRoleName(roles);
    return this;
  }

  /**
   * Specify actions for current control
   * @param actions - The name(s) of actions
   * @returns This GuardControl instance for chaining
   * @example
   * ```typescript
   * control.to('view')
   * control.to(['view', 'edit'])
   * ```
   */
  to(actions: string | string[]): this {
    this._actions = [
      ...new Set([...this._actions, ...canonicalPermissionActions(actions)]),
    ];
    return this;
  }

  /**
   * Specify resources for current control
   * @param resources - The name(s) of resources
   * @returns This GuardControl instance for chaining
   * @example
   * ```typescript
   * control.on('blog')
   * control.on(['blog', 'post'])
   * ```
   */
  on(resources: string | string[]): this {
    this._resources = [
      ...new Set([...this._resources, ...permissionResources(resources)]),
    ];
    return this;
  }

  /**
   * Commit current control - saves to database
   * @returns Promise resolved with role and assigned permissions
   * @example
   * ```typescript
   * await control.commit()
   * ```
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
