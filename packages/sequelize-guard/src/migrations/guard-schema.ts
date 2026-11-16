import {
  DataTypes,
  Utils,
  type ModelAttributes,
  type Sequelize,
} from 'sequelize';
import {
  getGuardResourceSchema,
  getGuardPermissionSchema,
  getGuardRoleSchema,
  getGuardRolePermissionSchema,
  getGuardRoleUserSchema,
  getGuardUserSchema,
  BaseModelType,
} from '../sequelize-models';
import { guardTable, sequelizeOptions } from '../sequelize-models/guard-tables';
import { getRoleHierarchySchema } from '../sequelize-models/GuardRoleHierarchy';
import { guardUserKey } from '../sequelize-models/user-key';
import type { GuardInternalOptions } from '../types';

/** Unbound columns for each Guard table. */
export const schemas = {
  resources: getGuardResourceSchema(),
  permissions: getGuardPermissionSchema(),
  roles: getGuardRoleSchema(),
  role_permission: getGuardRolePermissionSchema(),
  role_user: getGuardRoleUserSchema(),
  users: getGuardUserSchema(),
  role_hierarchy: getRoleHierarchySchema(),
} as const;

export function guardColumns(
  sequelize: Sequelize,
  options: GuardInternalOptions,
) {
  const userKey = guardUserKey(sequelize, options);
  const role = {
    model: guardTable(sequelize, options, BaseModelType.Roles),
    key: 'id',
  };
  const permission = {
    model: guardTable(sequelize, options, BaseModelType.Permissions),
    key: 'id',
  };
  const timestamps = Object.fromEntries(
    timestampColumns(sequelize, options).map(({ column, allowNull }) => [
      column,
      { type: DataTypes.DATE, allowNull },
    ]),
  );
  const { define } = sequelizeOptions(sequelize);
  const version = define?.version
    ? {
        [Utils.underscoredIf(
          typeof define.version === 'string' ? define.version : 'version',
          define.underscored,
        )]: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      }
    : {};
  const columns = (attributes: ModelAttributes): ModelAttributes => ({
    ...attributes,
    ...timestamps,
    ...version,
  });
  return {
    resources: columns(getGuardResourceSchema()),
    permissions: columns(getGuardPermissionSchema()),
    roles: columns(getGuardRoleSchema(role)),
    users: columns(getGuardUserSchema()),
    role_hierarchy: getRoleHierarchySchema(),
    role_permission: columns(
      getGuardRolePermissionSchema({
        roleReference: role,
        permissionReference: permission,
      }),
    ),
    role_user: columns(
      getGuardRoleUserSchema({
        roleReference: role,
        userReference: { model: userKey.table, key: userKey.column },
        userType: userKey.type,
      }),
    ),
  };
}

export function timestampColumns(
  sequelize: Sequelize,
  options: GuardInternalOptions,
) {
  if (!options.timestamps) return [];
  const { define } = sequelizeOptions(sequelize);
  const names = ['createdAt', 'updatedAt', 'deletedAt'] as const;
  return names
    .filter(
      (name) =>
        define?.[name] !== false && (name !== 'deletedAt' || options.paranoid),
    )
    .map((name) => {
      const configuredName = define?.[name];
      const attribute =
        typeof configuredName === 'string' ? configuredName : name;
      return {
        name,
        column: Utils.underscoredIf(attribute, define?.underscored),
        allowNull: name === 'deletedAt',
      };
    });
}
