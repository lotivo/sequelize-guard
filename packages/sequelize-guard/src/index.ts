/**
 * SequelizeGuard - Authorization Library for Sequelize
 * @packageDocumentation
 */

import { extendWithAuthorizePerms } from './authorize/authorizePerms';
import { extendWithAuthorizeRoles } from './authorize/authorizeRoles';
import { extendWithGuardControl } from './guard/init';
import { extendWithPermissions } from './guard/Permissions';
import { extendWithRoleHolders } from './guard/RoleHolders';
import { extendWithRoles } from './guard/Roles';
import { extendWithUsers } from './guard/Users';
import { SequelizeGuard, type SequelizeGuardType } from './SequelizeGuard';
import { extendWithCache } from './utils/cache';
import { extendWithUserCache } from './utils/userCache';

// Apply all extensions to SequelizeGuard
const extensions = [
  extendWithCache,
  extendWithUserCache,
  extendWithGuardControl,
  extendWithRoles,
  extendWithPermissions,
  extendWithUsers,
  extendWithRoleHolders,
  extendWithAuthorizePerms,
  extendWithAuthorizeRoles,
];

extensions.forEach((extension) =>
  extension(SequelizeGuard as SequelizeGuardType),
);

// Export the fully extended SequelizeGuard
export { SequelizeGuard };

// Export types
export * from './types';
export type {
  GuardPermissionData,
  GuardRoleData,
  GuardUserMethods,
} from './sequelize-models';

// Export migration and seeder
export { default as migration } from './migrations/guard-migrations';
export type { GuardUpgradeOptions } from './migrations/guard-upgrade';

// Default export
export default SequelizeGuard;
