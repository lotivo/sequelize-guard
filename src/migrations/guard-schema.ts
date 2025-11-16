import { DataTypes } from 'sequelize';
import {
  getGuardActionSchema,
  getGuardResourceSchema,
  getGuardPermissionSchema,
  getGuardRoleSchema,
  getGuardRolePermissionSchema,
  getGuardRoleUserSchema,
  getGuardUserSchema,
} from '../sequelize-models';

/**
 * Database schemas for Guard tables
 */
export const schemas = {
  actions: getGuardActionSchema(),
  resources: getGuardResourceSchema(),
  permissions: getGuardPermissionSchema(),
  roles: getGuardRoleSchema(),
  role_permission: getGuardRolePermissionSchema(),
  role_user: getGuardRoleUserSchema(),
  users: getGuardUserSchema(),
} as const;

export const timestamps = {
  basic: {
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  paranoid: {
    deleted_at: DataTypes.DATE,
  },
};
