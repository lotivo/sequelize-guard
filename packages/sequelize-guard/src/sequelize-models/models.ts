import type { Model, ModelStatic } from 'sequelize';
import type { SequelizeGuard } from '../SequelizeGuard';
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
import { GuardUserModel, initOrSetupGuardUser } from './GuardUser';
import { guardUserKey } from './user-key';

/**
 * Initialize and return all Guard models
 * @param guard
 */
export function initGuardModels(
  guard: SequelizeGuard,
  explicitUserPk?: string,
): GuardModels {
  const userKey = guardUserKey(guard.sequelize, guard.options, explicitUserPk);
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

/**
 * Collection of all Guard models
 */
export interface GuardModels<TUser extends Model = GuardUserModel> {
  GuardResource: GuardResourceModelStatic;
  GuardRole: GuardRoleModelStatic;
  GuardPermission: GuardPermissionModelStatic;
  RolePermission: GuardRolePermissionModelStatic;
  GuardUser: ModelStatic<TUser>;
  RoleUser: GuardRoleUserModelStatic;
}

export type GuardModel = GuardModels[keyof GuardModels];
