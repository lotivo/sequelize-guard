import type { GuardInternalOptions } from '../../types';

export enum BaseModelType {
  Resources = 'resources',
  Permissions = 'permissions',
  Roles = 'roles',
  Users = 'users',
  RoleHierarchy = 'role_hierarchy',
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
  [BaseModelType.RoleHierarchy]: 'role_hierarchy',
} as const;

export const defaultTableNames = Object.values(tablesMap);

export const baseModelsNameMap = {
  [BaseModelType.Resources]: 'resource',
  [BaseModelType.Permissions]: 'permission',
  [BaseModelType.Roles]: 'role',
  [BaseModelType.Users]: 'user',
  [BaseModelType.RoleHierarchy]: 'role_hierarchy',
} as const;

export const ModelClassNameMap = {
  [BaseModelType.Resources]: 'GuardResource',
  [BaseModelType.Permissions]: 'GuardPermission',
  [BaseModelType.Roles]: 'GuardRole',
  [AssociationModelType.RolePermission]: 'RolePermission',
  [AssociationModelType.RoleUser]: 'RoleUser',
  [BaseModelType.Users]: 'User',
  [BaseModelType.RoleHierarchy]: 'GuardRoleHierarchy',
} as const;

export const getTableName = (
  modelType: ModelType | `${ModelType}`,
  options: Pick<GuardInternalOptions, 'prefix'> &
    Partial<Pick<GuardInternalOptions, 'tables'>>,
) => {
  const suffix =
    modelType === BaseModelType.RoleHierarchy
      ? tablesMap[modelType]
      : (options.tables?.[modelType] ?? tablesMap[modelType]);
  return options.prefix + suffix;
};
