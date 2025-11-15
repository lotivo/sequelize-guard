import { DataTypes } from 'sequelize';
import type { ModelAttributes } from 'sequelize';

export const tablesMap = {
  actions: 'actions',
  resources: 'resources',
  permissions: 'permissions',
  roles: 'roles',
  role_user: 'role_user',
  role_permission: 'role_permission',
} as const;

export const tables = [
  'actions',
  'resources',
  'permissions',
  'roles',
  'role_user',
  'role_permission',
] as const;

export const models = {
  actions: 'action',
  resources: 'resource',
  permissions: 'permission',
  roles: 'role',
} as const;

/**
 * Database schemas for Guard tables
 */
export const schemas: Record<string, ModelAttributes> = {
  actions: {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER,
    },
    name: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },

  resources: {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER,
    },
    name: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },

  permissions: {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER,
    },
    name: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    resource: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    action: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    allow: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 1,
    },
  },

  roles: {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER,
    },
    name: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    parent_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },

  role_permission: {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    role_id: {
      allowNull: false,
      type: DataTypes.INTEGER,
    },
    permission_id: {
      allowNull: false,
      type: DataTypes.INTEGER,
    },
  },

  role_user: {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    role_id: {
      allowNull: false,
      type: DataTypes.INTEGER,
    },
    user_id: {
      allowNull: false,
      type: DataTypes.INTEGER,
    },
  },

  users: {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
  },
};

export const timestamps = {
  basic: {
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  paranoid: {
    deleted_at: DataTypes.DATE,
  },
};
