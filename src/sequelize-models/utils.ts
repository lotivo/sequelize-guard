import type { InitOptions } from 'sequelize';
import type { GuardInternalOptions } from '../types';

/**
 * Generate Sequelize model options from Guard options
 * @param options
 * @param tableName
 */
export function modelOptions(
  options: GuardInternalOptions,
  tableName?: string,
): Partial<InitOptions> {
  return {
    timestamps: options.timestamps,
    paranoid: options.paranoid,
    tableName,
  };
}
