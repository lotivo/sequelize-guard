import lodash from 'lodash';
import { Model } from 'sequelize';
import { defaultOptions } from '../constants';
import { BaseModelType, tablesMap } from '../sequelize-models/types/ModelType';
import type { GuardInternalOptions, GuardOptions } from '../types';

export function resolveGuardOptions(
  options: GuardOptions,
): GuardInternalOptions {
  if (!lodash.isPlainObject(options)) {
    throw new TypeError('Guard options must be a plain object');
  }

  for (const [name, value] of Object.entries(options)) {
    if (!Object.hasOwn(defaultOptions, name)) {
      throw new TypeError(`Unknown guard option "${name}"`);
    }
    if (value === undefined) continue;
    if (
      typeof defaultOptions[name as keyof GuardInternalOptions] === 'boolean' &&
      typeof value !== 'boolean'
    ) {
      throw new TypeError(`Guard option "${name}" must be a boolean`);
    }
  }

  const {
    tables,
    prefix,
    primaryKey,
    userPk,
    userCacheTtl,
    UserModel,
    roleHolders,
  } = options;
  if (prefix !== undefined && typeof prefix !== 'string') {
    throw new TypeError('Guard prefix must be a string');
  }
  if (primaryKey !== undefined && primaryKey !== 'id') {
    throw new TypeError('Guard primaryKey must be "id"');
  }
  if (userPk !== undefined && !isNonEmptyName(userPk)) {
    throw new TypeError('Guard userPk must be a non-empty string');
  }
  if (
    userCacheTtl !== undefined &&
    (!Number.isFinite(userCacheTtl) || userCacheTtl < 0)
  ) {
    throw new TypeError(
      'Guard userCacheTtl must be a finite non-negative number',
    );
  }
  if (UserModel != null && !isModelClass(UserModel)) {
    throw new TypeError(
      'Guard UserModel must be an initialized Sequelize model',
    );
  }
  if (tables !== undefined) validateTableSuffixes(tables);

  if (
    roleHolders !== undefined &&
    (!lodash.isPlainObject(roleHolders) ||
      !Object.values(roleHolders).every(isModelClass))
  ) {
    throw new TypeError('Guard roleHolders must map types to Sequelize models');
  }
  const resolved = {
    ...lodash.merge({}, defaultOptions, options),
    roleHolders: Object.freeze({ ...roleHolders }),
  };
  Object.freeze(resolved.tables);
  // Ownership checks and DDL must keep using the configuration that bound the models.
  for (const name of [
    'prefix',
    'tables',
    'primaryKey',
    'timestamps',
    'paranoid',
    'UserModel',
    'userPk',
    'roleHolders',
  ] as const) {
    Object.defineProperty(resolved, name, {
      writable: false,
      configurable: false,
    });
  }
  return resolved;
}

function validateTableSuffixes(
  tables: NonNullable<GuardOptions['tables']>,
): void {
  if (!lodash.isPlainObject(tables)) {
    throw new TypeError('Guard tables must be a plain object');
  }
  for (const [name, value] of Object.entries(tables)) {
    if (
      name === tablesMap[BaseModelType.RoleHierarchy] ||
      (!Object.hasOwn(tablesMap, name) && name !== 'meta' && name !== 'parents')
    ) {
      throw new TypeError(`Unknown guard table suffix "${name}"`);
    }
    if (value !== undefined && !isNonEmptyName(value)) {
      throw new TypeError(
        `Guard table suffix "${name}" must be a non-empty string`,
      );
    }
  }
}

function isNonEmptyName(value: unknown): value is string {
  return (
    typeof value === 'string' && !!value.trim() && !value.includes('\u0000')
  );
}

function isModelClass(value: unknown): boolean {
  return typeof value === 'function' && value.prototype instanceof Model;
}
