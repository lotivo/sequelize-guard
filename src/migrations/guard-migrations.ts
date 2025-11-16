import { merge } from 'lodash';
import type { QueryInterface, Sequelize } from 'sequelize';
import { defaultOptions } from '../constants';
import {
  AssociationModelType,
  BaseModelType,
  getTableName,
} from '../sequelize-models';
import type { GuardOptions } from '../types';
import { schemas, timestamps } from './guard-schema';

/**
 * Run migrations to create Guard tables
 * @param queryInterface
 * @param Sequelize
 * @param options
 */
async function up(
  queryInterface: QueryInterface,
  _Sequelize: Sequelize,
  options: GuardOptions = {},
): Promise<void> {
  const opts = merge({}, defaultOptions, options);

  const dateColumns = {
    ...(opts.timestamps && timestamps.basic),
    ...(opts.paranoid && timestamps.paranoid),
  };

  // Create all guard tables
  await queryInterface.createTable(getTableName('resources', opts), {
    ...schemas.resources,
    ...dateColumns,
  });

  await queryInterface.createTable(getTableName('permissions', opts), {
    ...schemas.permissions,
    ...dateColumns,
  });

  await queryInterface.createTable(getTableName('roles', opts), {
    ...schemas.roles,
    ...dateColumns,
  });

  // Create users table only if UserModel is not provided
  if (!opts.UserModel) {
    await queryInterface.createTable(getTableName('users', opts), {
      ...schemas.users,
      ...dateColumns,
    });
  }

  await queryInterface.createTable(getTableName('role_permission', opts), {
    ...schemas.role_permission,
    ...dateColumns,
  });

  await queryInterface.createTable(getTableName('role_user', opts), {
    ...schemas.role_user,
    ...dateColumns,
  });
}

/**
 * Rollback migrations - drop Guard tables
 * @param queryInterface
 * @param Sequelize
 * @param options
 */
async function down(
  queryInterface: QueryInterface,
  _Sequelize: Sequelize,
  options: GuardOptions = {},
): Promise<void> {
  const opts = merge({}, defaultOptions, options);

  await queryInterface.dropTable(getTableName('role_user', opts));
  await queryInterface.dropTable(getTableName('role_permission', opts));
  await queryInterface.dropTable(getTableName('roles', opts));
  await queryInterface.dropTable(getTableName('permissions', opts));
  await queryInterface.dropTable(getTableName('resources', opts));

  if (!opts.UserModel) {
    await queryInterface.dropTable(getTableName('users', opts));
  }
}

export const migrationOrder = {
  up: [
    BaseModelType.Resources,
    BaseModelType.Permissions,
    BaseModelType.Roles,
    BaseModelType.Users,
    AssociationModelType.RolePermission,
    AssociationModelType.RoleUser,
  ],
  down: [
    AssociationModelType.RoleUser,
    AssociationModelType.RolePermission,
    BaseModelType.Roles,
    BaseModelType.Permissions,
    BaseModelType.Resources,
    BaseModelType.Users,
  ],
};

export default {
  up,
  down,
};
