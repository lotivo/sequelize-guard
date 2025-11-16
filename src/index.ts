/**
 * SequelizeGuard - Authorization Library for Sequelize
 * @packageDocumentation
 */

import { extendWithAuthorizePerms } from './authorize/authorizePerms';
import { extendWithAuthorizeRoles } from './authorize/authorizeRoles';
import { extendWithGuardControl } from './guard/init';
import { extendWithPermissions } from './guard/Permissions';
import { extendWithRoles } from './guard/Roles';
import { extendWithUsers } from './guard/Users';
import { SequelizeGuard } from './SequelizeGuard';

// Import all extension modules
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
