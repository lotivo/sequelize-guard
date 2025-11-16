import type { QueryInterface } from 'sequelize';
import type { GuardOptions } from '../types';
import { schemas, timestamps } from './guard-schema';
import { merge } from 'lodash';
import { defaultOptions } from '../constants';
import { getTableName } from '../sequelize-models';

/**
 * Run migrations to create Guard tables
 */
async function up(
  queryInterface: QueryInterface,
  Sequelize: any,
  options: GuardOptions = {},
): Promise<void> {
  const opts = merge({}, defaultOptions, options);
  const prefix = opts.prefix;

  const dateColumns = () => ({
    ...(opts.timestamps && timestamps.basic),
    ...(opts.paranoid && timestamps.paranoid),
  });

  // Create all guard tables
  await queryInterface.createTable(getTableName('actions', opts), {
    ...schemas.actions,
    ...dateColumns(),
  });

  await queryInterface.createTable(getTableName('resources', opts), {
    ...schemas.resources,
    ...dateColumns(),
  });

  await queryInterface.createTable(getTableName('permissions', opts), {
    ...schemas.permissions,
    ...dateColumns(),
  });

  await queryInterface.createTable(getTableName('roles', opts), {
    ...schemas.roles,
    ...dateColumns(),
  });

  await queryInterface.createTable(getTableName('role_permission', opts), {
    ...schemas.role_permission,
    ...dateColumns(),
  });

  await queryInterface.createTable(getTableName('role_user', opts), {
    ...schemas.role_user,
    ...dateColumns(),
  });

  // Create users table only if UserModel is not provided
  if (!opts.UserModel) {
    await queryInterface.createTable(getTableName('users', opts), {
      ...schemas.users,
      ...dateColumns(),
    });
  }
}

/**
 * Rollback migrations - drop Guard tables
 */
async function down(
  queryInterface: QueryInterface,
  Sequelize: any,
  options: GuardOptions = {},
): Promise<void> {
  const opts = merge({}, defaultOptions, options);
  const prefix = opts.prefix;

  await queryInterface.dropTable(getTableName('role_user', opts));
  await queryInterface.dropTable(getTableName('role_permission', opts));
  await queryInterface.dropTable(getTableName('roles', opts));
  await queryInterface.dropTable(getTableName('permissions', opts));
  await queryInterface.dropTable(getTableName('resources', opts));
  await queryInterface.dropTable(getTableName('actions', opts));

  if (!opts.UserModel) {
    await queryInterface.dropTable(getTableName('users', opts));
  }
}

export default {
  up,
  down,
};
