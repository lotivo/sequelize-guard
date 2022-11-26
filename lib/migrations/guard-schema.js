const { DataTypes } = require('sequelize');

// let models = ['actions','resources','permissions','roles' ];
const models = {
  actions: 'action',
  resources: 'resource',
  permissions: 'permission',
  roles: 'role',
};
const tablesMap = {
  actions: 'actions',
  resources: 'resources',
  permissions: 'permissions',
  roles: 'roles',
  role_user: 'role_user',
  role_permission: 'role_permission',
};
const tables = [
  'actions',
  'resources',
  'permissions',
  'roles',
  'role_user',
  'role_permission',
];

//resources : post, image, comment, page
//actions : view, edit, delete, create, all
//permissions : allow edit, allow view, can, cannot
//roles : admin, mod

//role perm : allow admin edit post,

let schemas = (options) => ({
  actions: {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER,
    },
    display_name: {
      type: DataTypes.STRING,
      allowNull: true,
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
    display_name: {
      type: DataTypes.STRING,
      allowNull: true,
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
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: true,
    },
  },
  roles: {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER,
    },
    display_name: {
      type: DataTypes.STRING,
      allowNull: false,
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
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
      references: {
        model: options.prefix + 'roles',
        key: 'id',
      },
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
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
      references: {
        model: options.prefix + 'roles',
        key: 'id',
      },
    },
    permission_id: {
      allowNull: false,
      type: DataTypes.INTEGER,
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
      references: {
        model: options.prefix + 'permissions',
        key: 'id',
      },
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
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
      references: {
        model: options.prefix + 'roles',
        key: 'id',
      },
    },
    [`${options.UserModel.name.toLowerCase()}_${options.userPk}`]: {
      allowNull: false,
      type: DataTypes[options.UserModel.getAttributes()[options.userPk].type.toString()],
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
      references: {
        model: options.UserModel.tableName,
        key: options.userPk,
      },
    },
  },

  users: {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: DataTypes.STRING,
    email: {
      type: DataTypes.STRING,
      unique: {
        name: 'users_email',
        msg: 'A user with this email already exists.',
      },
      allowNull: true,
      validate: {
        notEmpty: true,
        isEmail: true,
      },
    },
  },
});

const timestamps = {
  basic: {
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  paranoid: {
    deleted_at: DataTypes.DATE,
  },
};

module.exports = {
  tables,
  tablesMap,
  schemas,
  timestamps,
  models,
};
