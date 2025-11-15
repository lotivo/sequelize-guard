import type { QueryInterface } from 'sequelize';
import type { GuardOptions } from '../types';
import { schemas, tablesMap } from './guard-schema';
import { merge } from 'lodash';
import { defaultOptions } from '../constants';

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

  // Create all guard tables
  await queryInterface.createTable(prefix + tablesMap.resources, {
    ...schemas.resources,
    ...(opts.timestamps && {
      created_at: Sequelize.DATE,
      updated_at: Sequelize.DATE,
    }),
    ...(opts.paranoid && { deleted_at: Sequelize.DATE }),
  });

  await queryInterface.createTable(prefix + tablesMap.permissions, {
    ...schemas.permissions,
    ...(opts.timestamps && {
      created_at: Sequelize.DATE,
      updated_at: Sequelize.DATE,
    }),
    ...(opts.paranoid && { deleted_at: Sequelize.DATE }),
  });

  await queryInterface.createTable(prefix + tablesMap.roles, {
    ...schemas.roles,
    ...(opts.timestamps && {
      created_at: Sequelize.DATE,
      updated_at: Sequelize.DATE,
    }),
    ...(opts.paranoid && { deleted_at: Sequelize.DATE }),
  });

  await queryInterface.createTable(prefix + tablesMap.role_permission, {
    ...schemas.role_permission,
    ...(opts.timestamps && {
      created_at: Sequelize.DATE,
      updated_at: Sequelize.DATE,
    }),
    ...(opts.paranoid && { deleted_at: Sequelize.DATE }),
  });

  await queryInterface.createTable(prefix + tablesMap.role_user, {
    ...schemas.role_user,
    ...(opts.timestamps && {
      created_at: Sequelize.DATE,
      updated_at: Sequelize.DATE,
    }),
    ...(opts.paranoid && { deleted_at: Sequelize.DATE }),
  });

  // Create users table only if UserModel is not provided
  if (!opts.UserModel) {
    await queryInterface.createTable(prefix + 'users', {
      ...schemas.users,
      ...(opts.timestamps && {
        created_at: Sequelize.DATE,
        updated_at: Sequelize.DATE,
      }),
      ...(opts.paranoid && { deleted_at: Sequelize.DATE }),
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

  await queryInterface.dropTable(prefix + tablesMap.role_user);
  await queryInterface.dropTable(prefix + tablesMap.role_permission);
  await queryInterface.dropTable(prefix + tablesMap.roles);
  await queryInterface.dropTable(prefix + tablesMap.permissions);
  await queryInterface.dropTable(prefix + tablesMap.resources);

  if (!opts.UserModel) {
    await queryInterface.dropTable(prefix + 'users');
  }
}

export default {
  up,
  down,
};
