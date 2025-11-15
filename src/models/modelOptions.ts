import type { InitOptions } from 'sequelize';
import type { GuardInternalOptions } from '../types';

/**
 * Generate Sequelize model options from Guard options
 */
export function modelOptions(
  options: GuardInternalOptions,
): Partial<InitOptions> {
  return {
    timestamps: options.timestamps,
    paranoid: options.paranoid,
  };
}
