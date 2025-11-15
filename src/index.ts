/**
 * SequelizeGuard - Authorization Library for Sequelize
 *
 * @packageDocumentation
 */

import { SequelizeGuard } from './SequelizeGuard';

// Import all extension modules
import { extendWithCache } from './utils/cache';
import { extendWithUserCache } from './utils/userCache';
import { extendWithGuardControl } from './guard/init';
import { extendWithRoles } from './guard/Roles';
import { extendWithPermissions } from './guard/Permissions';
import { extendWithUsers } from './guard/Users';
import { extendWithAuthorizePerms } from './authorize/authorizePerms';
import { extendWithAuthorizeRoles } from './authorize/authorizeRoles';

// Apply all extensions to SequelizeGuard
const extensions = [
  extendWithCache,
  extendWithUserCache,
  extendWithGuardControl,
  extendWithRoles,
  extendWithPermissions,
  extendWithUsers,
  extendWithAuthorizePerms,
  extendWithAuthorizeRoles,
];

extensions.forEach((extension) => extension(SequelizeGuard as any));

// Export the fully extended SequelizeGuard
export { SequelizeGuard };

// Export types
export * from './types';

// Export migration and seeder
export { default as migration } from './migrations/guard-migrations';
export { default as seeder } from './seeder';

// Default export
export default SequelizeGuard;
