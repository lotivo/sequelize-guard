import { uniq } from 'lodash';
import type { SequelizeGuard } from '../SequelizeGuard';
import type { AddPermsToRoleResult } from '../types';

/**
 * GuardControl - Fluent API for creating guard statements
 *
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
  private guard: SequelizeGuard;
  _roles: string;
  _actions: string[];
  _resources: string[];

  constructor(guard: SequelizeGuard) {
    this.guard = guard;
    this._roles = '';
    this._actions = [];
    this._resources = [];
  }

  /**
   * Specify role to allow
   *
   * @param roles - The name of role
   * @returns This GuardControl instance for chaining
   *
   * @example
   * ```typescript
   * control.allow('admin')
   * ```
   */
  allow(roles: string): this {
    if (typeof roles === 'string') {
      this._roles = roles;
    }
    return this;
  }

  /**
   * Specify actions for current control
   *
   * @param actions - The name(s) of actions
   * @returns This GuardControl instance for chaining
   *
   * @example
   * ```typescript
   * control.to('view')
   * control.to(['view', 'edit'])
   * ```
   */
  to(actions: string | string[]): this {
    if (typeof actions === 'string') {
      this._actions = uniq([...this._actions, actions]);
    }

    if (Array.isArray(actions)) {
      this._actions = uniq([...this._actions, ...actions]);
    }

    return this;
  }

  /**
   * Specify resources for current control
   *
   * @param resources - The name(s) of resources
   * @returns This GuardControl instance for chaining
   *
   * @example
   * ```typescript
   * control.on('blog')
   * control.on(['blog', 'post'])
   * ```
   */
  on(resources: string | string[]): this {
    if (typeof resources === 'string') {
      this._resources = uniq([...this._resources, resources]);
    }

    if (Array.isArray(resources)) {
      this._resources = uniq([...this._resources, ...resources]);
    }

    return this;
  }

  /**
   * Commit current control - saves to database
   *
   * @returns Promise resolved with role and assigned permissions
   *
   * @example
   * ```typescript
   * await control.commit()
   * ```
   */
  async commit(): Promise<AddPermsToRoleResult> {
    const roles = this._roles;
    const actions = this._actions;
    const resources = this._resources;

    return (this.guard as any).addPermsToRole(roles, actions, resources);
  }
}
