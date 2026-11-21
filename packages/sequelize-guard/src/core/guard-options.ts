import lodash from 'lodash';
import { Model } from 'sequelize';
import { defaultOptions } from '../constants';
import type { GuardInternalOptions, GuardOptions } from '../types';

export function resolveGuardOptions(
  options: GuardOptions<Model>,
): GuardInternalOptions {
  if (!lodash.isPlainObject(options))
    throw new TypeError('Guard options must be a plain object');
  for (const [name, value] of Object.entries(options)) {
    if (!Object.hasOwn(defaultOptions, name))
      throw new TypeError(`Unknown guard option "${name}"`);
    if (
      value !== undefined &&
      typeof defaultOptions[name as keyof GuardInternalOptions] === 'boolean' &&
      typeof value !== 'boolean'
    )
      throw new TypeError(`Guard option "${name}" must be a boolean`);
  }
  if (options.prefix !== undefined && typeof options.prefix !== 'string')
    throw new TypeError('Guard prefix must be a string');
  if (options.primaryKey !== undefined && options.primaryKey !== 'id')
    throw new TypeError('Guard primaryKey must be "id"');
  if (
    options.userPk !== undefined &&
    (typeof options.userPk !== 'string' || !options.userPk.trim())
  )
    throw new TypeError('Guard userPk must be a non-empty string');
  if (
    options.userCacheTtl !== undefined &&
    (!Number.isFinite(options.userCacheTtl) || options.userCacheTtl < 0)
  )
    throw new TypeError(
      'Guard userCacheTtl must be a finite non-negative number',
    );
  if (
    options.UserModel != null &&
    !(
      typeof options.UserModel === 'function' &&
      options.UserModel.prototype instanceof Model
    )
  )
    throw new TypeError(
      'Guard UserModel must be an initialized Sequelize model',
    );
  if (options.tables !== undefined) {
    if (!lodash.isPlainObject(options.tables))
      throw new TypeError('Guard tables must be a plain object');
    for (const [name, value] of Object.entries(options.tables)) {
      if (!Object.hasOwn(defaultOptions.tables, name))
        throw new TypeError(`Unknown guard table suffix "${name}"`);
      if (value !== undefined && (typeof value !== 'string' || !value.trim()))
        throw new TypeError(
          `Guard table suffix "${name}" must be a non-empty string`,
        );
    }
  }
  const resolved = lodash.merge(
    {},
    defaultOptions,
    options,
  ) as GuardInternalOptions;
  Object.freeze(resolved.tables);
  for (const name of [
    'prefix',
    'tables',
    'primaryKey',
    'timestamps',
    'paranoid',
    'UserModel',
    'userPk',
  ] as const)
    Object.defineProperty(resolved, name, {
      writable: false,
      configurable: false,
    });
  return resolved;
}
