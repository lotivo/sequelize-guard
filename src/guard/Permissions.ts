import { differenceBy, concat } from 'lodash';
import {
  Op,
  FindOptions,
  WhereOptions,
  InferAttributes,
  InferCreationAttributes,
} from 'sequelize';
import { GuardPermissionModel } from '../sequelize-models';
import type { SequelizeGuard } from '../SequelizeGuard';
import type {
  CreatePermsOptions,
  FindPermsArgs,
  BulkPermissionInput,
  PermissionData,
  GuardEventCallback,
  UnsubscribeFn,
} from '../types';

declare module '../SequelizeGuard' {
  interface SequelizeGuard {
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
  }
}

/**
 * Extend SequelizeGuard with permission management methods
 * @param SequelizeGuard
 */
export function extendWithPermissions(
  SequelizeGuard: typeof import('../SequelizeGuard').SequelizeGuard,
): void {
  /**
   * Create permissions
   * @param resources
   * @param actions
   * @param options
   */
  SequelizeGuard.prototype.createPerms = async function (
    resources: string | string[],
    actions: string | string[],
    options: CreatePermsOptions = {},
  ): Promise<GuardPermissionModel[]> {
    const permissions = this._sanitizePermsInput(resources, actions, options);
    return insertPermissionsToDb(this, permissions, options);
  };

  /**
   * Create permissions in bulk
   * @param permissions
   * @param options
   */
  SequelizeGuard.prototype.createPermsBulk = async function (
    permissions: BulkPermissionInput[],
    options: CreatePermsOptions = {},
  ): Promise<GuardPermissionModel[]> {
    const sanitized = permissions.map((p) => {
      let _acts: string[] = [];
      if (typeof p.actions === 'string') _acts = [p.actions];
      if (Array.isArray(p.actions)) _acts = p.actions;

      return {
        name: p.name || `${p.resource}:[${_acts.toString()}]`,
        resource: p.resource,
        action: JSON.stringify(_acts),
      };
    });

    return insertPermissionsToDb(this, sanitized, options);
  };

  /**
   * Find permissions
   * @param args
   */
  SequelizeGuard.prototype.findPerms = async function (
    args: FindPermsArgs = {},
  ): Promise<GuardPermissionModel[]> {
    const wheres: WhereOptions<InferAttributes<GuardPermissionModel>>[] = [];
    const cond: FindOptions<InferAttributes<GuardPermissionModel>> = {
      where: {},
    };

    if (args.search) {
      if (args.name) {
        wheres.push({ name: { [Op.substring]: args.name } });
      }
      if (args.resource) {
        wheres.push({ resource: { [Op.substring]: args.resource } });
      }
      if (args.action) {
        wheres.push({ action: { [Op.substring]: args.action } });
      }
    } else {
      if (args.name) wheres.push({ name: args.name });
      if (args.resource) wheres.push({ resource: args.resource });
      if (args.action) wheres.push({ action: args.action });
    }

    if (wheres.length >= 1) {
      cond.where = { [Op.or]: wheres };
    }

    const perms = await this._models.GuardPermission.findAll(cond);
    return perms;
  };

  /**
   * Sanitize permission input
   * @param resources
   * @param actions
   * @param options
   */
  SequelizeGuard.prototype._sanitizePermsInput = function (
    resources: string | string[],
    actions: string | string[],
    options: CreatePermsOptions = {},
  ): PermissionData[] {
    let _acts: string[] = [];
    let _res: string[] = [];

    const optionsNames = options.names || [];

    if (typeof resources === 'string') _res = [resources];
    if (Array.isArray(resources)) _res = resources;

    if (typeof actions === 'string') _acts = [actions];
    if (Array.isArray(actions)) _acts = actions;

    const permissions = _res.map((r, i) => ({
      name: optionsNames[i] || `${r}:[${_acts.toString()}]`,
      resource: r,
      action: JSON.stringify(_acts),
    }));

    return permissions;
  };

  /**
   * Event listener
   * @param cb
   */
  SequelizeGuard.prototype.onPermsCreated = function (
    cb: GuardEventCallback<GuardPermissionModel[]>,
  ): UnsubscribeFn {
    return this.on('onPermsCreated', cb);
  };
}

/**
 * Helper function to insert permissions to database
 * @param guard
 * @param permissions
 * @param options
 */
async function insertPermissionsToDb(
  guard: SequelizeGuard,
  permissions: PermissionData[],
  options: CreatePermsOptions,
): Promise<GuardPermissionModel[]> {
  const existPerms = await guard._models.GuardPermission.findAll({
    where: { name: permissions.map((d) => d.name.toLowerCase()) },
  });

  const perms2insert = differenceBy(permissions, existPerms, (r) => r.name);

  const perms = await guard._models.GuardPermission.bulkCreate(
    perms2insert as Array<InferCreationAttributes<GuardPermissionModel>>,
  );

  guard.emit('onPermsCreated', perms);

  let result: GuardPermissionModel[] = perms;
  if (options.all) {
    result = concat(existPerms, perms);
  }
  if (options.json) {
    return result.map((perm) => perm.toJSON());
  }

  return result;
}
