export enum BaseModelType {
  Resources = 'resources',
  Permissions = 'permissions',
  Roles = 'roles',
  Users = 'users',
}

export enum AssociationModelType {
  RolePermission = 'role_permission',
  RoleUser = 'role_user',
}

export type ModelType = BaseModelType | AssociationModelType;

export const tablesMap = {
  [BaseModelType.Resources]: 'resources',
  [BaseModelType.Permissions]: 'permissions',
  [BaseModelType.Roles]: 'roles',
  [AssociationModelType.RolePermission]: 'role_permission',
  [AssociationModelType.RoleUser]: 'role_user',
  [BaseModelType.Users]: 'users',
} as const;

export const defaultTableNames = Object.values(tablesMap);

export const baseModelsNameMap = {
  [BaseModelType.Resources]: 'resource',
  [BaseModelType.Permissions]: 'permission',
  [BaseModelType.Roles]: 'role',
  [BaseModelType.Users]: 'user',
} as const;

export const ModelClassNameMap = {
  [BaseModelType.Resources]: 'GuardResource',
  [BaseModelType.Permissions]: 'GuardPermission',
  [BaseModelType.Roles]: 'GuardRole',
  [AssociationModelType.RolePermission]: 'RolePermission',
  [AssociationModelType.RoleUser]: 'RoleUser',
  [BaseModelType.Users]: 'User',
} as const;

export const getTableName = (
  modelType: ModelType | `${ModelType}`,
  options: { prefix: string },
) => {
  return options.prefix + tablesMap[modelType];
};
