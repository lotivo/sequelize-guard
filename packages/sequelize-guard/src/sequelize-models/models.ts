import type { Model } from 'sequelize';
import type { SequelizeGuardInstance } from '../SequelizeGuard';
import {
  guardTable,
  physicalTableKey,
  validateGuardTables,
} from './guard-tables';
import {
  GuardPermissionModelStatic,
  initGuardPermission,
} from './GuardPermission';
import { GuardResourceModelStatic, initGuardResource } from './GuardResource';
import { GuardRoleModelStatic, initGuardRole } from './GuardRole';
import {
  GuardRolePermissionModelStatic,
  initGuardRolePermission,
} from './GuardRolePermission';
import { GuardRoleUserModelStatic, initGuardRoleUser } from './GuardRoleUser';
import {
  GuardUserModel,
  GuardUserModelStatic,
  initOrSetupGuardUser,
} from './GuardUser';
import {
  BaseModelType,
  ModelClassNameMap,
  type ModelType,
} from './types/ModelType';
import { guardUserKey } from './user-key';

/**
 * Initialize and return all Guard models
 * @param guard
 */
export function initGuardModels(
  guard: SequelizeGuardInstance,
): GuardModels<Model> {
  const userKey = guardUserKey(guard.sequelize, guard.options);
  validateGuardTables(guard.sequelize, guard.options);
  assertModelNamesAvailable(guard);

  const GuardResource = initGuardResource(guard);
  const GuardPermission = initGuardPermission(guard);
  const GuardRole = initGuardRole(guard);

  const RolePermission = initGuardRolePermission(guard, {
    GuardRole,
    GuardPermission,
  });

  const GuardUser = initOrSetupGuardUser(guard);

  const RoleUser = initGuardRoleUser(
    guard,
    {
      GuardRole,
      GuardUser,
    },
    userKey,
  );

  return {
    GuardResource,
    GuardRole,
    GuardPermission,
    RolePermission,
    GuardUser,
    RoleUser,
  };
}

function assertModelNamesAvailable({
  sequelize,
  options,
}: SequelizeGuardInstance): void {
  const owned = (Object.keys(ModelClassNameMap) as ModelType[]).filter(
    (type) => type !== BaseModelType.Users || !options.UserModel,
  );
  const tables = new Set(
    owned.map((type) =>
      physicalTableKey(sequelize, guardTable(sequelize, options, type)),
    ),
  );
  for (const type of owned) {
    const name = ModelClassNameMap[type];
    if (name in sequelize.models) {
      throw new Error(`Sequelize model registry already defines "${name}"`);
    }
  }
  for (const model of sequelize.modelManager.models) {
    if (model === options.UserModel) continue;
    const table = model.getTableName();
    if (tables.has(physicalTableKey(sequelize, table))) {
      const name = typeof table === 'string' ? table : table.tableName;
      throw new Error(
        `Guard table "${name}" already belongs to model "${model.name}"`,
      );
    }
  }
}

/**
 * Collection of all Guard models
 */
export interface GuardModels<TUser extends Model = GuardUserModel> {
  GuardResource: GuardResourceModelStatic;
  GuardRole: GuardRoleModelStatic;
  GuardPermission: GuardPermissionModelStatic;
  RolePermission: GuardRolePermissionModelStatic;
  GuardUser: GuardUserModelStatic<TUser>;
  RoleUser: GuardRoleUserModelStatic;
}

export type GuardModel = GuardModels[keyof GuardModels];
