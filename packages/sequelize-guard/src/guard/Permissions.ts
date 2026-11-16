import { createHash } from 'node:crypto';
import { Op } from 'sequelize';
import type { FindOptions, InferAttributes, WhereOptions } from 'sequelize';
import {
  isPermissionToken,
  readPermissionActions,
} from '../authorize/permissionGrammar';
import type { GuardPermissionModel } from '../sequelize-models';
import type { SequelizeGuard, SequelizeGuardType } from '../SequelizeGuard';
import type {
  CreatePermsOptions,
  FindPermsArgs,
  BulkPermissionInput,
  PermissionData,
  GuardEventCallback,
  UnsubscribeFn,
} from '../types';
import { findOrInsertPolicyRecord, mutatePolicy } from './policyMutation';
import type { PolicyMutation } from './policyMutation';

interface PermissionDefinition extends PermissionData {
  generated: boolean;
}

/**
 * Extend SequelizeGuard with permission management methods
 * @param SequelizeGuard
 */
export function extendWithPermissions(
  SequelizeGuard: SequelizeGuardType,
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
    const permissions = permissionInputs(resources, actions, options);
    return mutatePolicy(this, options, (mutation) =>
      createPermissions(this, permissions, mutation, options),
    );
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
    validateNames(permissions.length, options);
    const sanitized = Array.from(permissions, (permission, index) =>
      makePermission(
        permission.resource,
        canonicalPermissionActions(permission.actions),
        permission.name ?? options.name ?? options.names?.[index],
      ),
    );
    if (!sanitized.length) return [];
    return mutatePolicy(this, options, (mutation) =>
      createPermissions(this, sanitized, mutation, options),
    );
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
      useMaster: true,
      transaction: null,
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
    return permissionInputs(resources, actions, options).map(
      ({ action, name, resource }) => ({ action, name, resource }),
    );
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

export function canonicalPermissionActions(
  actions: string | string[],
): string[] {
  const values = typeof actions === 'string' ? [actions] : actions;
  if (
    !Array.isArray(values) ||
    !values.length ||
    !Array.from(values).every(isPermissionToken)
  ) {
    throw new TypeError('Permission actions must be non-empty tokens');
  }
  return [...new Set(values)].sort();
}

export function permissionResources(resources: string | string[]): string[] {
  const values = typeof resources === 'string' ? [resources] : resources;
  if (!Array.isArray(values) || !values.length) {
    throw new TypeError('At least one permission resource is required');
  }
  const snapshot = Array.from(values);
  if (!snapshot.every(isPermissionToken)) {
    throw new TypeError('Permission resources must be non-empty tokens');
  }
  return snapshot;
}

export function permissionInputs(
  resources: string | string[],
  actions: string | string[],
  options: CreatePermsOptions = {},
): PermissionDefinition[] {
  const values = permissionResources(resources);
  validateNames(values.length, options);
  const actionSet = canonicalPermissionActions(actions);
  return Array.from(values, (resource, index) =>
    makePermission(resource, actionSet, options.name ?? options.names?.[index]),
  );
}

function validateNames(
  count: number,
  { name, names }: CreatePermsOptions,
): void {
  if (name !== undefined && (count !== 1 || names !== undefined)) {
    throw new TypeError(
      'Use name for one permission or names for multiple permissions',
    );
  }
  if (names !== undefined && !Array.isArray(names)) {
    throw new TypeError('Permission names must be an array');
  }
  if (names && names.length > count) {
    throw new TypeError('Too many permission names');
  }
}

export function makePermission(
  resource: string,
  canonicalActions: string[],
  providedName?: string,
): PermissionDefinition {
  if (!isPermissionToken(resource)) {
    throw new TypeError('Permission resources must be non-empty tokens');
  }
  const generated = providedName === undefined || providedName === '';
  const name = generated
    ? generatedPermissionName(resource, canonicalActions)
    : providedName.trim();
  if (!name || name.length > 255 || name.includes('\u0000')) {
    throw new TypeError(
      'Permission names must contain between 1 and 255 characters',
    );
  }
  return {
    name,
    resource,
    action: JSON.stringify(canonicalActions),
    generated,
  };
}

function generatedPermissionName(resource: string, actions: string[]): string {
  const escape = (token: string) =>
    token.replace(
      /[^a-z0-9_*.-]/gu,
      (character) => `%${Buffer.from(character).toString('hex')}%`,
    );
  const name = `${escape(resource)}:[${actions.map(escape).join(',')}]`;
  if (name.length <= 255) return name;
  return `permission-sha256:${createHash('sha256').update(name).digest('hex')}`;
}

function hasDefinition(
  permission: GuardPermissionModel,
  definition: PermissionDefinition,
) {
  const actions = readPermissionActions(permission.action);
  return (
    permission.resource === definition.resource &&
    actions !== null &&
    JSON.stringify(canonicalPermissionActions(actions)) === definition.action
  );
}

export async function createPermissions(
  guard: SequelizeGuard,
  permissions: PermissionDefinition[],
  { transaction, emitAfterCommit }: PolicyMutation,
  options: CreatePermsOptions = {},
): Promise<GuardPermissionModel[]> {
  const definitions = new Map<string, PermissionDefinition>();
  for (const permission of permissions) {
    const prior = definitions.get(permission.name);
    if (
      prior &&
      (prior.resource !== permission.resource ||
        prior.action !== permission.action)
    ) {
      throw permissionNameConflict(permission.name);
    }
    if (!prior || !permission.generated)
      definitions.set(permission.name, permission);
  }
  if (!definitions.size) return [];

  const model = guard._models.GuardPermission;
  const generatedResources = [
    ...new Set(
      [...definitions.values()]
        .filter((permission) => permission.generated)
        .map((permission) => permission.resource),
    ),
  ];
  // Earlier versions generated names from the original, unsorted action array.
  const legacyPermissions = generatedResources.length
    ? await model.findAll({
        where: { resource: generatedResources },
        order: [['id', 'ASC']],
        transaction,
        useMaster: true,
      })
    : [];
  const legacyByName = new Map<string, GuardPermissionModel>();
  for (const permission of legacyPermissions) {
    const actions = readPermissionActions(permission.action);
    if (
      !actions ||
      permission.name !== `${permission.resource}:[${actions.join(',')}]`
    ) {
      continue;
    }
    const name = generatedPermissionName(
      permission.resource,
      canonicalPermissionActions(actions),
    );
    if (!legacyByName.has(name)) legacyByName.set(name, permission);
  }

  const results = new Map<string, GuardPermissionModel>();
  const createdPermissions: GuardPermissionModel[] = [];

  for (const name of [...definitions.keys()].sort()) {
    const definition = definitions.get(name)!;
    const legacy = definition.generated ? legacyByName.get(name) : undefined;
    if (legacy && legacy.name !== name && hasDefinition(legacy, definition)) {
      results.set(name, legacy);
      continue;
    }

    const [permission, created] = await findOrInsertPolicyRecord(
      model,
      {
        where: { name },
        transaction,
        useMaster: true,
        lock: transaction.LOCK.SHARE,
      },
      { name, resource: definition.resource, action: definition.action },
    );
    if (permission.name !== name || !hasDefinition(permission, definition)) {
      throw permissionNameConflict(name);
    }
    results.set(name, permission);
    if (created) createdPermissions.push(permission);
  }

  const createdIds = new Set(
    createdPermissions.map((permission) => permission.id),
  );
  const result = [
    ...new Map(
      [...definitions.keys()]
        .map((name) => results.get(name)!)
        .filter((permission) => options.all || createdIds.has(permission.id))
        .map((permission) => [permission.id, permission]),
    ).values(),
  ];
  if (createdPermissions.length)
    emitAfterCommit('onPermsCreated', createdPermissions);
  return options.json
    ? result.map((permission) => permission.toJSON())
    : result;
}

function permissionNameConflict(name: string): Error {
  return new Error(`Permission "${name}" already has a different definition`);
}
