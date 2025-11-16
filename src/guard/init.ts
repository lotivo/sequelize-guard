import { GuardControl } from './GuardControl';
import type { AddPermsToRoleResult } from '../types';

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
   */
  SequelizeGuard.prototype.allow = function (
    role: string,
    actions: string | string[],
    resources: string | string[],
  ): Promise<AddPermsToRoleResult> {
    return this.init().allow(role).to(actions).on(resources).commit();
  };
}
