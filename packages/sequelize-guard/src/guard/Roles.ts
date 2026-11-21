import lodash from 'lodash';
import {
  Op,
  FindOptions,
  WhereOptions,
  InferAttributes,
  InferCreationAttributes,
} from 'sequelize';
import type { GuardRoleData, GuardRoleModel } from '../sequelize-models';
import type { SequelizeGuardType } from '../SequelizeGuard';
import type {
  RoleCreationResult,
  FindRolesArgs,
  CreateRolesOptions,
  RoleData,
  AddPermsToRoleResult,
  RemovePermsFromRoleResult,
  UnsubscribeFn,
  GuardEventCallback,
  RoleCreationParam,
  GuardCreationResult,
} from '../types';

/**
 * Extend SequelizeGuard with role management methods
 * @param SequelizeGuard
 */
export function extendWithRoles(SequelizeGuard: SequelizeGuardType): void {
  /**
   * Creates a new role if not already present
   * @param role
   */
  SequelizeGuard.prototype.makeRole = async function (
    role: RoleCreationParam,
    description?: string,
  ): Promise<RoleCreationResult> {
    this._assertModelBindings();
    if (!role) throw new Error('Role must be string with length not zero');

    const roleData = makeRoleData(role);
    const [createdRole, created] = await this._models.GuardRole.findOrCreate({
      useMaster: true,
      where: {
        name: roleData.name,
      },
      defaults: {
        ...roleData,
        description,
      },
    });

    this.emit('onRolesCreated', [createdRole]);
    return { role: createdRole, created };
  };

  /**
   * Create multiple roles
   * @param roles
   * @param options
   */
  SequelizeGuard.prototype.makeRoles = async function <
    TOptions extends [options?: CreateRolesOptions],
  >(roles: RoleCreationParam[], ...[givenOptions]: TOptions) {
    this._assertModelBindings();
    const options = givenOptions ?? { json: true };
    const sanitizedRoles = sanitizeRolesInput(roles);
    let roles2insert = [...sanitizedRoles];

    const existRoles = await this._models.GuardRole.findAll({
      useMaster: true,
    });
    const rNames = existRoles.map((d) => d.name);
    const toRemove = roles2insert.filter((r) => rNames.indexOf(r.name) >= 0);
    roles2insert = roles2insert.filter((r) => rNames.indexOf(r.name) < 0);

    const insertedRoles = await this._models.GuardRole.bulkCreate(
      roles2insert as Array<InferCreationAttributes<GuardRoleModel>>,
    );

    if (insertedRoles.length) {
      this.emit('onRolesCreated', insertedRoles);
    }

    let result = insertedRoles;
    if (options.json) {
      result = result.map((role) => role.toJSON());
    }

    if (options.all) {
      const existingFiltered = lodash.filter(existRoles, (r) =>
        toRemove.map((t) => t.name).includes(r.name),
      );
      result = lodash.concat(
        options.json
          ? existingFiltered.map((role) => role.toJSON())
          : existingFiltered,
        result,
      );
    }

    return result as GuardCreationResult<
      TOptions[0],
      GuardRoleModel,
      GuardRoleData,
      GuardRoleData
    >;
  };

  /**
   * Delete multiple roles
   * @param roles
   */
  SequelizeGuard.prototype.deleteRoles = async function (
    roles: string | RoleCreationParam[] | GuardRoleModel[],
  ): Promise<number> {
    this._assertModelBindings();
    const sanitizedRoles = sanitizeRolesInput(roles);
    const rolesToDelete = await this._models.GuardRole.findAll({
      where: { name: { [Op.in]: sanitizedRoles.map((role) => role.name) } },
      useMaster: true,
    });

    if (!rolesToDelete.length) return 0;

    const deletedCount = await this._models.GuardRole.destroy({
      where: {
        name: { [Op.in]: rolesToDelete.map((d) => d.name) },
      },
    });

    this.emit('onRolesDeleted', rolesToDelete);
    return deletedCount;
  };

  /**
   * Get all available roles
   */
  SequelizeGuard.prototype.allRoles = async function (): Promise<
    GuardRoleModel[]
  > {
    return this._readCommitted(() =>
      this._models.GuardRole.findAll({ useMaster: true, transaction: null }),
    );
  };

  /**
   * Get role by name
   * @param role
   */
  SequelizeGuard.prototype.getRole = async function (
    role: string,
  ): Promise<GuardRoleModel | null> {
    return this._readCommitted(() =>
      this._models.GuardRole.findOne({
        where: { name: role.toLowerCase() },
        useMaster: true,
        transaction: null,
      }),
    );
  };

  /**
   * Find roles
   * @param args
   */
  SequelizeGuard.prototype.findRoles = async function (
    args: FindRolesArgs = {},
  ): Promise<GuardRoleModel[]> {
    const wheres: WhereOptions<InferAttributes<GuardRoleModel>>[] = [];
    const cond: FindOptions<InferAttributes<GuardRoleModel>> = { where: {} };

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

    const roles = await this._readCommitted(() =>
      this._models.GuardRole.findAll({
        ...cond,
        useMaster: true,
        transaction: null,
      }),
    );
    return roles;
  };

  /**
   * Add permissions to role
   * @param role
   * @param actions
   * @param resources
   */
  SequelizeGuard.prototype.addPermsToRole = async function (
    role: string | GuardRoleModel,
    actions: string | string[],
    resources: string | string[],
  ): Promise<AddPermsToRoleResult> {
    this._assertModelBindings();
    const perms = await this.createPerms(resources, actions, {
      all: true,
    });

    const { role: roleModel } = await this.makeRole(role);
    const roles = await this.findRoles({ name: roleModel.name });
    const roleToUpdate = roles[0];

    const assignedPerms = await roleToUpdate.getPermissions!();
    const perms2add = lodash.differenceBy(perms, assignedPerms, (r) => r.name);

    await roleToUpdate.addPermissions!(perms2add);

    roleToUpdate.Permissions = [...assignedPerms, ...perms2add];
    // TODO: Check why this was in previous version.
    // roleToUpdate.dataValues.Permissions = roleToUpdate.Permissions;

    this.emit('onPermsAddedToRole', roleToUpdate);

    return {
      role: roleToUpdate,
      permissions: roleToUpdate.Permissions,
    };
  };

  /**
   * Remove permissions from role
   * @param role
   * @param actions
   * @param resources
   */
  SequelizeGuard.prototype.rmPermsFromRole = async function (
    role: string,
    actions: string | string[],
    resources: string | string[],
  ): Promise<RemovePermsFromRoleResult> {
    this._assertModelBindings();
    const perms2rmIn = this._sanitizePermsInput(resources, actions);

    const { role: roleModel } = await this.makeRole(role);
    const roles = await this._models.GuardRole.findAll({
      where: { name: roleModel.name },
      useMaster: true,
    });
    const roleToUpdate = roles[0];

    const assignedPerms = await roleToUpdate.getPermissions!({
      useMaster: true,
    });
    const perms2rm = lodash.intersectionBy(
      assignedPerms,
      perms2rmIn,
      (r) => r.resource + r.action,
    );

    await roleToUpdate.removePermissions!(perms2rm);

    roleToUpdate.Permissions = lodash.without(assignedPerms, ...perms2rm);
    // roleToUpdate.dataValues.Permissions = roleToUpdate.Permissions;

    //TODO: Make enum for all the events, create proper event management system
    this.emit('onPermsRemovedFromRole', roleToUpdate);

    return {
      role: roleToUpdate,
      permissions: roleToUpdate.Permissions,
      permsRemoved: perms2rm,
    };
  };

  /**
   * Event listeners
   * @param cb
   */
  SequelizeGuard.prototype.onRolesCreated = function (
    cb: GuardEventCallback<GuardRoleModel[]>,
  ): UnsubscribeFn {
    return this.on('onRolesCreated', cb);
  };

  SequelizeGuard.prototype.onRolesDeleted = function (
    cb: GuardEventCallback<GuardRoleModel[]>,
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
 * @param role
 */
function makeRoleData(role: RoleCreationParam): RoleData {
  if (typeof role === 'string') {
    return { name: role.toLowerCase() };
  }
  return {
    ...role,
    name: role.name.toLowerCase(),
  };
}

/**
 *
 * @param roles
 */
function sanitizeRolesInput(roles: string | RoleCreationParam[]): RoleData[] {
  if (typeof roles === 'string') {
    return [makeRoleData(roles)];
  }

  return roles
    .map((role) => makeRoleData(role))
    .filter((role) => typeof role.name === 'string' && role.name.length > 0);
}
