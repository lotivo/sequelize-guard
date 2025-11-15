import {
  find,
  differenceBy,
  concat,
  filter,
  uniq,
  without,
  intersectionBy,
} from 'lodash';
import { Op } from 'sequelize';
import type { SequelizeGuard } from '../SequelizeGuard';
import type {
  GuardRoleModel,
  RoleCreationResult,
  FindRolesArgs,
  CreateRolesOptions,
  RoleData,
  AddPermsToRoleResult,
  RemovePermsFromRoleResult,
  UnsubscribeFn,
  GuardEventCallback,
} from '../types';

declare module '../SequelizeGuard' {
  interface SequelizeGuard {
    makeRole(role: string): Promise<RoleCreationResult>;
    makeRoles(
      roles: string[],
      options?: CreateRolesOptions,
    ): Promise<GuardRoleModel[]>;
    deleteRoles(roles: string[]): Promise<number>;
    allRoles(): Promise<any[]>;
    getRole(role: string): Promise<any | null>;
    findRoles(args?: FindRolesArgs): Promise<GuardRoleModel[]>;
    addPermsToRole(
      role: string,
      actions: string | string[],
      resources: string | string[],
    ): Promise<AddPermsToRoleResult>;
    rmPermsFromRole(
      role: string,
      actions: string | string[],
      resources: string | string[],
    ): Promise<RemovePermsFromRoleResult>;
    onRolesCreated(cb: GuardEventCallback<GuardRoleModel[]>): UnsubscribeFn;
    onRolesDeleted(cb: GuardEventCallback<any[]>): UnsubscribeFn;
    onPermsAddedToRole(cb: GuardEventCallback<GuardRoleModel>): UnsubscribeFn;
    onPermsRemovedFromRole(
      cb: GuardEventCallback<GuardRoleModel>,
    ): UnsubscribeFn;
    _sanitizePermsInput(
      resources: string | string[],
      actions: string | string[],
      options?: any,
    ): any[];
  }
}

/**
 * Extend SequelizeGuard with role management methods
 */
export function extendWithRoles(
  SequelizeGuard: typeof import('../SequelizeGuard').SequelizeGuard,
): void {
  /**
   * Creates a new role if not already present
   */
  SequelizeGuard.prototype.makeRole = async function (
    role: string,
  ): Promise<RoleCreationResult> {
    if (!role) throw new Error('Role must be string with length not zero');

    const roleData = makeRoleData(role);
    const cache = await this.getCache();
    const roles = Object.values(cache.getRoles());
    const existingRole = find(roles, roleData);

    if (existingRole) {
      return { role: existingRole as any, created: false };
    }

    const [createdRole, created] = await this._models.GuardRole.findOrCreate({
      where: roleData as any,
    });

    this.emit('onRolesCreated', [createdRole]);
    return { role: createdRole as GuardRoleModel, created };
  };

  /**
   * Create multiple roles
   */
  SequelizeGuard.prototype.makeRoles = async function (
    roles: string[],
    options: CreateRolesOptions = { json: true },
  ): Promise<GuardRoleModel[]> {
    const sanitizedRoles = sanitizeRolesInput(roles);
    let roles2insert = [...sanitizedRoles];

    const cache = await this.getCache();
    const existRoles = Object.values(cache.getRoles());
    const rNames = existRoles.map((d: any) => d.name);
    const toRemove = roles2insert.filter((r) => rNames.indexOf(r.name) >= 0);
    roles2insert = roles2insert.filter((r) => rNames.indexOf(r.name) < 0);

    const insertedRoles = await this._models.GuardRole.bulkCreate(
      roles2insert as any,
    );

    if (insertedRoles.length) {
      this.emit('onRolesCreated', insertedRoles);
    }

    let result: any[] = insertedRoles;
    if (options.json) {
      result = result.map((role) => role.toJSON());
    }

    if (options.all) {
      const existingFiltered = filter(existRoles, (r: any) =>
        toRemove.map((t) => t.name).includes(r.name),
      );
      result = concat(existingFiltered, result);
    }

    return result as GuardRoleModel[];
  };

  /**
   * Delete multiple roles
   */
  SequelizeGuard.prototype.deleteRoles = async function (
    roles: string[],
  ): Promise<number> {
    const sanitizedRoles = sanitizeRolesInput(roles);
    const cache = await this.getCache();
    const cacheRoles = Object.values(cache.getRoles());
    const roleNames = sanitizedRoles.map((d) => d.name);
    const rolesToDelete = filter(
      cacheRoles,
      (role: any) => roleNames.indexOf(role.name) >= 0,
    );

    if (!rolesToDelete.length) return 0;

    const deletedCount = await this._models.GuardRole.destroy({
      where: { name: rolesToDelete.map((d: any) => d.name) },
    });

    this.emit('onRolesDeleted', rolesToDelete);
    return deletedCount;
  };

  /**
   * Get all available roles
   */
  SequelizeGuard.prototype.allRoles = async function (): Promise<any[]> {
    const cache = await this.getCache();
    return Object.values(cache.getRoles());
  };

  /**
   * Get role by name
   */
  SequelizeGuard.prototype.getRole = async function (
    role: string,
  ): Promise<any | null> {
    const cache = await this.getCache();
    const roles = Object.values(cache.getRoles()).filter(
      (r: any) => r.name === role.toLowerCase(),
    );
    return roles.length ? roles[0] : null;
  };

  /**
   * Find roles
   */
  SequelizeGuard.prototype.findRoles = async function (
    args: FindRolesArgs = {},
  ): Promise<GuardRoleModel[]> {
    const wheres: any[] = [];
    const cond: any = { where: {} };

    if (args.names && args.names.length) {
      if (args.search) {
        args.names.forEach((name) => {
          wheres.push({ name: { [Op.substring]: name } });
        });
      } else {
        args.names.forEach((name) => {
          wheres.push({ [Op.or]: { name } });
        });
      }
    } else if (args.name) {
      wheres.push({ name: args.name });
    }

    if (wheres.length > 0) {
      cond.where = { [Op.or]: wheres };
    }

    if (args.withParent) {
      cond.include = 'Parent';
    }

    const roles = await this._models.GuardRole.findAll(cond);
    return roles as GuardRoleModel[];
  };

  /**
   * Add permissions to role
   */
  SequelizeGuard.prototype.addPermsToRole = async function (
    role: string,
    actions: string | string[],
    resources: string | string[],
  ): Promise<AddPermsToRoleResult> {
    const perms = await (this as any).createPerms(resources, actions, {
      all: true,
    });

    const { role: roleModel } = await this.makeRole(role);
    const roles = await this.findRoles({ name: roleModel.name });
    const roleToUpdate = roles[0];

    const assignedPerms = await roleToUpdate.getPermissions!();
    const perms2add = differenceBy(perms, assignedPerms, (r: any) => r.name);

    await roleToUpdate.addPermissions!(perms2add as any);

    (roleToUpdate as any).Permissions = [...assignedPerms, ...perms2add];
    (roleToUpdate as any).dataValues.Permissions = (
      roleToUpdate as any
    ).Permissions;

    this.emit('onPermsAddedToRole', roleToUpdate);

    return {
      role: roleToUpdate,
      permissions: (roleToUpdate as any).Permissions,
    };
  };

  /**
   * Remove permissions from role
   */
  SequelizeGuard.prototype.rmPermsFromRole = async function (
    role: string,
    actions: string | string[],
    resources: string | string[],
  ): Promise<RemovePermsFromRoleResult> {
    const perms2rmIn = this._sanitizePermsInput(resources, actions);

    const { role: roleModel } = await this.makeRole(role);
    const roles = await this.findRoles({ name: roleModel.name });
    const roleToUpdate = roles[0];

    const assignedPerms = await roleToUpdate.getPermissions!();
    const perms2rm = intersectionBy(
      assignedPerms,
      perms2rmIn,
      (r: any) => r.resource + r.action,
    );

    await roleToUpdate.removePermissions!(perms2rm as any);

    (roleToUpdate as any).Permissions = without(assignedPerms, ...perms2rm);
    (roleToUpdate as any).dataValues.Permissions = (
      roleToUpdate as any
    ).Permissions;

    this.emit('onPermsRemovedFromRole', roleToUpdate);

    return {
      role: roleToUpdate,
      permissions: (roleToUpdate as any).Permissions,
      permsRemoved: perms2rm,
    };
  };

  /**
   * Event listeners
   */
  SequelizeGuard.prototype.onRolesCreated = function (
    cb: GuardEventCallback<GuardRoleModel[]>,
  ): UnsubscribeFn {
    return this.on('onRolesCreated', cb);
  };

  SequelizeGuard.prototype.onRolesDeleted = function (
    cb: GuardEventCallback<any[]>,
  ): UnsubscribeFn {
    return this.on('onRolesDeleted', cb);
  };

  SequelizeGuard.prototype.onPermsAddedToRole = function (
    cb: GuardEventCallback<GuardRoleModel>,
  ): UnsubscribeFn {
    return this.on('onPermsAddedToRole', cb);
  };

  SequelizeGuard.prototype.onPermsRemovedFromRole = function (
    cb: GuardEventCallback<GuardRoleModel>,
  ): UnsubscribeFn {
    return this.on('onPermsRemovedFromRole', cb);
  };
}

/**
 * Helper functions
 */
function makeRoleData(role: string): RoleData {
  if (typeof role === 'string') {
    return { name: role.toLowerCase() };
  }
  return { name: '' };
}

function sanitizeRolesInput(roles: string[]): RoleData[] {
  if (typeof roles === 'string') {
    roles = [roles] as any;
  }
  return roles
    .map((role) => makeRoleData(role))
    .filter((role) => typeof role.name === 'string' && role.name.length > 0);
}
