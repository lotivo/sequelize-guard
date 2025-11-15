import type {
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  ForeignKey,
  NonAttribute,
  Association,
  ModelStatic,
} from 'sequelize';

/**
 * GuardResource Model - Represents resources in the system (e.g., blog, post, image)
 */
export interface GuardResourceModel
  extends Model<
    InferAttributes<GuardResourceModel>,
    InferCreationAttributes<GuardResourceModel>
  > {
  id: CreationOptional<number>;
  name: string;
  description?: string;
}

/**
 * GuardPermission Model - Represents permissions (e.g., view blog, edit post)
 */
export interface GuardPermissionModel
  extends Model<
    InferAttributes<GuardPermissionModel>,
    InferCreationAttributes<GuardPermissionModel>
  > {
  id: CreationOptional<number>;
  name: string;
  description?: string;
  resource: string;
  action: string; // JSON stringified array
  allow: CreationOptional<number>;

  // Associations
  Roles?: NonAttribute<GuardRoleModel[]>;
}

/**
 * GuardRole Model - Represents roles (e.g., admin, moderator)
 */
export interface GuardRoleModel
  extends Model<
    InferAttributes<GuardRoleModel>,
    InferCreationAttributes<GuardRoleModel>
  > {
  id: CreationOptional<number>;
  name: string;
  description?: string;
  parent_id?: ForeignKey<GuardRoleModel['id']>;

  // Associations
  Permissions?: NonAttribute<GuardPermissionModel[]>;
  Users?: NonAttribute<GuardUserModel[]>;
  ChildRoles?: NonAttribute<GuardRoleModel[]>;
  Parent?: NonAttribute<GuardRoleModel>;

  // Methods added by associations
  getPermissions?: () => Promise<GuardPermissionModel[]>;
  addPermissions?: (
    permissions: (GuardPermissionModel | number)[],
  ) => Promise<void>;
  removePermissions?: (
    permissions: (GuardPermissionModel | number)[],
  ) => Promise<void>;
  getRoles?: () => Promise<GuardRoleModel[]>;
  addRole?: (roleId: number) => Promise<void>;
  addRoles?: (roleIds: number[]) => Promise<void>;
  removeRoles?: (roles: GuardRoleModel[]) => Promise<void>;
}

/**
 * RolePermission Junction Model
 */
export interface RolePermissionModel
  extends Model<
    InferAttributes<RolePermissionModel>,
    InferCreationAttributes<RolePermissionModel>
  > {
  id: CreationOptional<number>;
  role_id: ForeignKey<GuardRoleModel['id']>;
  permission_id: ForeignKey<GuardPermissionModel['id']>;
}

/**
 * GuardUser Model - Can be custom or default
 */
export interface GuardUserModel
  extends Model<
    InferAttributes<GuardUserModel>,
    InferCreationAttributes<GuardUserModel>
  > {
  id: CreationOptional<number>;
  name?: string;
  email?: string;

  // Associations
  Roles?: NonAttribute<GuardRoleModel[]>;

  // Methods added by associations and guard extensions
  getRoles?: () => Promise<GuardRoleModel[]>;
  addRole?: (roleId: number) => Promise<void>;
  addRoles?: (roleIds: number[]) => Promise<void>;
  removeRoles?: (roles: GuardRoleModel[]) => Promise<void>;

  // Guard authorization methods (added by extensions)
  can?: (permission: string) => Promise<boolean>;
  cant?: (permission: string) => Promise<boolean>;
  isA?: (role: string) => Promise<boolean>;
  isAn?: (role: string) => Promise<boolean>;
  isAllOf?: (roles: string[]) => Promise<boolean>;
  isAnyOf?: (roles: string[]) => Promise<boolean>;
  assignRole?: (role: string) => Promise<GuardUserModel>;
  assignRoles?: (roles: string[]) => Promise<void>;
  rmAssignedRoles?: (roles: string[]) => Promise<void>;
}

/**
 * RoleUser Junction Model
 */
export interface RoleUserModel
  extends Model<
    InferAttributes<RoleUserModel>,
    InferCreationAttributes<RoleUserModel>
  > {
  id: CreationOptional<number>;
  role_id: ForeignKey<GuardRoleModel['id']>;
  user_id: ForeignKey<GuardUserModel['id']>;
}

/**
 * Collection of all Guard models
 */
export interface GuardModels {
  GuardResource: ModelStatic<GuardResourceModel>;
  GuardRole: ModelStatic<GuardRoleModel>;
  GuardPermission: ModelStatic<GuardPermissionModel>;
  RolePermission: ModelStatic<RolePermissionModel>;
  GuardUser: ModelStatic<GuardUserModel>;
  RoleUser: ModelStatic<RoleUserModel>;
}
