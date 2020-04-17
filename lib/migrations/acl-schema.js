const { DataTypes } = require("sequelize");

// let models = ['actions','resources','permissions','roles' ];
let models = { actions: 'action', resources: 'resource', permissions: 'permission', roles: 'role',  };
let tablesMap = { actions: 'actions', resources: 'resources', permissions: 'permissions', roles: 'roles', role_user:'role_user', role_permission: 'role_permission'   };
let tables = ['actions','resources','permissions', 'roles', 'role_user', 'role_permission'  ];

//resources : post, image, comment, page
//actions : view, edit, delete, create, all
//permissions : allow edit, allow view, can, cannot
//roles : admin, mod

//role perm : allow admin edit post,

let schemas = {

    actions : {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: DataTypes.INTEGER
        },
        name: {
            type: DataTypes.STRING,
            unique : true,
            allowNull : false
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    },
    resources : {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: DataTypes.INTEGER
        },
        name: {
            type: DataTypes.STRING,
            unique : true,
            allowNull : false
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    },
    permissions : {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: DataTypes.INTEGER
        },
        name: {
            type: DataTypes.STRING,
            unique : true,
            allowNull : true
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
        allow : {
            type : DataTypes.TINYINT,
            allowNull : true,
            defaultValue : 1
        }
    },
    roles : {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: DataTypes.INTEGER
        },
        name: {
            type: DataTypes.STRING,
            unique : true,
            allowNull : false
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        parent_id : {
            type: DataTypes.INTEGER,
            allowNull: true,
        }
    },
    role_permission : {
        id : {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        role_id : {
            allowNull: false,
            type: DataTypes.INTEGER
        },
        permission_id : {
            allowNull: false,
            type: DataTypes.INTEGER
        },
    },
    role_user : {
        id : {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        role_id : {
            allowNull: false,
            type: DataTypes.INTEGER
        },
        user_id : {
            allowNull: false,
            type: DataTypes.INTEGER
        },
    },

    users : {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        name: DataTypes.STRING,
        email:{
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
    }

};

const timestamps = {
    basic : {
        created_at: DataTypes.DATE,
        updated_at: DataTypes.DATE,
    },
    paranoid : {
        deleted_at: DataTypes.DATE
    }
}

module.exports = {
    tables, tablesMap, schemas, timestamps, models
};
