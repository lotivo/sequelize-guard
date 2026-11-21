import lodash from 'lodash';
import type { QueryInterface, QueryOptions, Sequelize } from 'sequelize';
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
  const opts = lodash.merge({}, defaultOptions, options);
  const readOptions: QueryOptions = { useMaster: true };

  const dateColumns = {
    ...(opts.timestamps && timestamps.basic),
    ...(opts.paranoid && timestamps.paranoid),
  };

  const tableNames: Parameters<typeof getTableName>[0][] = [
    'resources',
    'permissions',
    'roles',
    ...(!opts.UserModel ? (['users'] as const) : []),
    'role_permission',
    'role_user',
  ];
  if (
    (
      await Promise.all(
        tableNames.map(async (name) =>
          queryInterface.tableExists(getTableName(name, opts), readOptions),
        ),
      )
    ).some(Boolean)
  ) {
    throw new Error('Guard migration target table already exists');
  }

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
  const opts = lodash.merge({}, defaultOptions, options);
  const readOptions: QueryOptions = { useMaster: true };

  const definitions: [Parameters<typeof getTableName>[0], string[]][] = [
    ['resources', ['id', 'name', 'description']],
    [
      'permissions',
      ['id', 'name', 'description', 'resource', 'action', 'allow'],
    ],
    ['roles', ['id', 'name', 'description', 'parent_id']],
    ['users', ['id']],
    ['role_permission', ['id', 'role_id', 'permission_id']],
    ['role_user', ['id', 'role_id', 'user_id']],
  ];
  if (opts.UserModel) definitions.splice(3, 1);
  const tables = definitions.map(([name]) => getTableName(name, opts));
  const present = await Promise.all(
    tables.map(async (table) => queryInterface.tableExists(table, readOptions)),
  );
  if (present.some(Boolean)) {
    if (present.some((exists) => !exists)) {
      throw new Error('Incomplete legacy Guard schema; refusing rollback');
    }
    for (const [index, [, required]] of definitions.entries()) {
      const columns = await queryInterface.describeTable(
        tables[index],
        readOptions,
      );
      const dateColumns = [
        ...(opts.timestamps ? ['createdAt', 'updatedAt'] : []),
        ...(opts.paranoid ? ['deletedAt'] : []),
      ];
      const valid =
        required.every((name) => {
          const column = columns[name];
          if (!column) return false;
          return [
            'id',
            'role_id',
            'user_id',
            'permission_id',
            'parent_id',
            'allow',
          ].includes(name)
            ? /INT/i.test(column.type)
            : /CHAR|TEXT|CITEXT/i.test(column.type);
        }) &&
        columns.id.primaryKey &&
        dateColumns.every((name) => {
          const snake = name.replace(
            /[A-Z]/g,
            (letter) => `_${letter.toLowerCase()}`,
          );
          return Boolean(columns[name] || columns[snake]);
        });
      if (!valid) {
        throw new Error('Incompatible legacy Guard table; refusing rollback');
      }
    }
  }

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
