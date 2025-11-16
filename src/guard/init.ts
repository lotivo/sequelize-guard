import type { AddPermsToRoleResult } from '../types';
import { GuardControl } from './GuardControl';

declare module '../SequelizeGuard' {
  interface SequelizeGuard {
    init(): GuardControl;
    allow(
      role: string,
      actions: string | string[],
      resources: string | string[],
    ): Promise<AddPermsToRoleResult>;
  }
}

/**
 * Extend SequelizeGuard with GuardControl fluent API
 * @param SequelizeGuard
 */
export function extendWithGuardControl(
  SequelizeGuard: typeof import('../SequelizeGuard').SequelizeGuard,
): void {
  /**
   * Start new guard statement
   */
  SequelizeGuard.prototype.init = function (): GuardControl {
    return new GuardControl(this);
  };

  /**
   * Create guard statement in one line
   * @param role
   * @param actions
   * @param resources
   */
  SequelizeGuard.prototype.allow = function (
    role: string,
    actions: string | string[],
    resources: string | string[],
  ): Promise<AddPermsToRoleResult> {
    return this.init().allow(role).to(actions).on(resources).commit();
  };
}
