import { GuardControl } from './guard/GuardControl';
import {
  GuardPermissionModel,
  GuardRoleData,
  GuardRoleModel,
  GuardUserModel,
} from './sequelize-models';
import {
  AddPermsToRoleResult,
  BulkPermissionInput,
  CreatePermsOptions,
  CreateRolesOptions,
  FindPermsArgs,
  FindRolesArgs,
  GuardEventCallback,
  PermissionData,
  RemovePermsFromRoleResult,
  RoleCreationParam,
  RoleCreationResult,
  UnsubscribeFn,
} from './types/api';
import { GuardCache } from './utils/cache';
import { GuardUserCache } from './utils/userCache';

declare module './SequelizeGuard' {
  interface SequelizeGuard {
    // init
    init(): GuardControl;
    allow(
      role: string,
      actions: string | string[],
      resources: string | string[],
    ): Promise<AddPermsToRoleResult>;

    // Permission guard methods
    createPerms(
      resources: string | string[],
      actions: string | string[],
      options?: CreatePermsOptions,
    ): Promise<GuardPermissionModel[]>;
    createPermsBulk(
      permissions: BulkPermissionInput[],
      options?: CreatePermsOptions,
    ): Promise<GuardPermissionModel[]>;
    findPerms(args?: FindPermsArgs): Promise<GuardPermissionModel[]>;
    onPermsCreated(
      cb: GuardEventCallback<GuardPermissionModel[]>,
    ): UnsubscribeFn;
    onPermsAddedToRole(cb: GuardEventCallback<GuardRoleModel>): UnsubscribeFn;
    onPermsRemovedFromRole(
      cb: GuardEventCallback<GuardRoleModel>,
    ): UnsubscribeFn;
    _sanitizePermsInput(
      resources: string | string[],
      actions: string | string[],
      options?: CreatePermsOptions,
    ): PermissionData[];

    // Role guard methods
    makeRole(role: RoleCreationParam): Promise<RoleCreationResult>;
    makeRoles(
      roles: RoleCreationParam[],
      options?: CreateRolesOptions,
    ): Promise<GuardRoleModel[]>;
    deleteRoles(
      roles: string | RoleCreationParam[] | GuardRoleModel[],
    ): Promise<number>;
    allRoles(): Promise<GuardRoleModel[]>;
    getRole(role: string): Promise<GuardRoleModel | null>;
    findRoles(args?: FindRolesArgs): Promise<GuardRoleModel[]>;
    addPermsToRole(
      role: string | GuardRoleModel,
      actions: string | string[],
      resources: string | string[],
    ): Promise<AddPermsToRoleResult>;
    rmPermsFromRole(
      role: string,
      actions: string | string[],
      resources: string | string[],
    ): Promise<RemovePermsFromRoleResult>;
    onRolesCreated(cb: GuardEventCallback<GuardRoleModel[]>): UnsubscribeFn;
    onRolesDeleted(cb: GuardEventCallback<GuardRoleModel[]>): UnsubscribeFn;

    // User guard methods
    makeUser(): Promise<GuardUserModel>;
    assignRole(user: GuardUserModel, role: string): Promise<GuardUserModel>;
    assignRoles(user: GuardUserModel, roles: string[]): Promise<void>;
    rmAssignedRoles(user: GuardUserModel, roles: string[]): Promise<void>;
    getUserRoles(user: GuardUserModel): Promise<GuardRoleData[]>;

    //User permission resolution methods
    userCan(user: GuardUserModel, permission: string): Promise<boolean>;
    userCant(user: GuardUserModel, permission: string): Promise<boolean>;
    resolvePermission(
      givenPermissions: { action: string; resource: string }[],
      wantedPermission: string,
    ): boolean;

    // User role resolution methods
    userHasRoles(user: GuardUserModel, roles: string[]): Promise<boolean>;
    userHasAllRoles(user: GuardUserModel, roles: string[]): Promise<boolean>;
    userIsA(user: GuardUserModel, role: string): Promise<boolean>;

    // Cache
    resetCache(): GuardCache;
    getCache(): Promise<GuardCache>;

    // User cache
    resetUserCache(): GuardUserCache;
    getUserCache(): GuardUserCache;
  }
}
