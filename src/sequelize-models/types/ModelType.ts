export enum BaseModelType {
  Actions = 'actions',
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
  [BaseModelType.Actions]: 'actions',
  [BaseModelType.Resources]: 'resources',
  [BaseModelType.Permissions]: 'permissions',
  [BaseModelType.Roles]: 'roles',
  [AssociationModelType.RoleUser]: 'role_user',
  [AssociationModelType.RolePermission]: 'role_permission',
  [BaseModelType.Users]: 'users',
} as const;

export const tableNames = Object.values(tablesMap);

export const baseModelsNameMap = {
  [BaseModelType.Actions]: 'action',
  [BaseModelType.Resources]: 'resource',
  [BaseModelType.Permissions]: 'permission',
  [BaseModelType.Roles]: 'role',
  [BaseModelType.Users]: 'user',
} as const;

export const ModelClassNameMap = {
  [BaseModelType.Actions]: 'GuardAction',
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
