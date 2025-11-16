import type { SequelizeGuard } from '../SequelizeGuard';
import { GuardActionModelStatic, initGuardAction } from './GuardAction';
import { GuardResourceModelStatic, initGuardResource } from './GuardResource';
import {
  GuardPermissionModelStatic,
  initGuardPermission,
} from './GuardPermission';
import { GuardRoleModelStatic, initGuardRole } from './GuardRole';
import {
  GuardRolePermissionModelStatic,
  initGuardRolePermission,
} from './GuardRolePermission';
import { GuardRoleUserModelStatic, initGuardRoleUser } from './GuardRoleUser';
import { GuardUserModelStatic, initOrSetupGuardUser } from './GuardUser';

/**
 * Initialize and return all Guard models
 */
export function initGuardModels(guard: SequelizeGuard): GuardModels {
  const GuardAction = initGuardAction(guard);
  const GuardResource = initGuardResource(guard);
  const GuardPermission = initGuardPermission(guard);
  const GuardRole = initGuardRole(guard);

  const RolePermission = initGuardRolePermission(guard, {
    GuardRole,
    GuardPermission,
  });

  const GuardUser = initOrSetupGuardUser(guard);

  const RoleUser = initGuardRoleUser(guard, {
    GuardRole,
    GuardUser,
  });

  return {
    GuardAction,
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
export interface GuardModels {
  GuardAction: GuardActionModelStatic;
  GuardResource: GuardResourceModelStatic;
  GuardRole: GuardRoleModelStatic;
  GuardPermission: GuardPermissionModelStatic;
  RolePermission: GuardRolePermissionModelStatic;
  GuardUser: GuardUserModelStatic;
  RoleUser: GuardRoleUserModelStatic;
}
