/**
 * Default configuration options for SequelizeGuard
 */

import type { GuardInternalOptions } from './types';

export const defaultOptions: GuardInternalOptions = {
  tables: {
    meta: 'meta',
    parents: 'parents',
    permissions: 'permissions',
    resources: 'resources',
    roles: 'roles',
    users: 'users',
  },
  prefix: 'guard_',
  primaryKey: 'id',
  timestamps: false,
  paranoid: false,
  sync: true,
  debug: false,
  UserModel: null,
  userPk: 'id',
  safeGuardDeletes: true,
  userCache: true,
  userCacheTtl: 60,
};
