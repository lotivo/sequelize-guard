import lodash from 'lodash';
import { Op } from 'sequelize';
import type { FindOptions, InferAttributes, Model, Transaction } from 'sequelize';
import { readPermissionActions } from '../authorize/permissionGrammar';
import type {
  GuardPermissionModel,
  GuardRoleData,
  GuardRoleModel,
} from '../sequelize-models';
import type { SequelizeGuard, SequelizeGuardType } from '../SequelizeGuard';
import type {
  RoleCreationResult,
  FindRolesArgs,
  CreateRolesOptions,
  RoleData,
  AddPermsToRoleResult,
  RemovePermsFromRoleResult,
  UnsubscribeFn,
  GuardCreationResult,
  GuardEventCallback,
  RoleCreationParam,
  PolicyMutationOptions,
} from '../types';
import {
  canonicalPermissionActions,
  createPermissions,
  makePermission,
  permissionInputs,
} from './Permissions';
import {
  canArchiveLinks,
  findOrInsertPolicyRecord,
  mutatePolicy,
  policyBatchSize,
} from './policyMutation';
import type { PolicyMutation } from './policyMutation';

/**
 * Extend SequelizeGuard with role management methods
 * @param SequelizeGuard
 */
export function extendWithRoles(SequelizeGuard: SequelizeGuardType): void {
  /**
   * Creates a new role if not already present
   * @param role
   * @param options
   */
  SequelizeGuard.prototype.makeRole = async function (
    role: RoleCreationParam,
    options: PolicyMutationOptions = {},
  ): Promise<RoleCreationResult> {
    const roleData = makeRoleData(role);
    return mutatePolicy(
      this as unknown as SequelizeGuard<Model>,
      options,
      async (mutation) => {
        const result = await createRole(
          this as unknown as SequelizeGuard<Model>,
          roleData,
          mutation.transaction,
        );
        if (result.created) {
          mutation.emitAfterCommit('onRolesCreated', [result.role]);
        }
        return result;
      },
    );
  };

  /**
   * Create multiple roles
   * @param roles
   * @param options
   */
  SequelizeGuard.prototype.makeRoles = async function <
    TOptions extends [options?: CreateRolesOptions],
  >(
    roles: RoleCreationParam[],
    ...[options]: TOptions
  ): Promise<
    GuardCreationResult<
      TOptions[0],
      GuardRoleModel,
      GuardRoleData,
      GuardRoleData
    >
  > {
    const roleData = roleInputs(roles);
    const result = roleData.length
      ? await mutatePolicy(
          this as unknown as SequelizeGuard<Model>,
          options ?? {},
          async (mutation) => {
            const models = await createRoles(
              this as unknown as SequelizeGuard<Model>,
              roleData,
              mutation,
              options,
            );
            return options === undefined || options.json
              ? models.map((role) => role.toJSON<GuardRoleData>())
              : models;
          },
        )
      : [];
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
   * @param options
   */
  SequelizeGuard.prototype.deleteRoles = async function (
    roles: string | RoleCreationParam[] | GuardRoleModel[],
    options: PolicyMutationOptions = {},
  ): Promise<number> {
    const names = roleInputs(roles).map((role) => role.name);
    if (!names.length) return 0;

    return mutatePolicy(
      this as unknown as SequelizeGuard<Model>,
      options,
      async ({ transaction, emitAfterCommit }) => {
        const rolesToDelete = await lockRoles(
          this as unknown as SequelizeGuard<Model>,
          names,
          transaction,
        );
        if (!rolesToDelete.length) return 0;

        const { GuardRole, RolePermission, RoleUser } = this._models;
        const ids = rolesToDelete.map((role) => role.id);
        const links = { where: { role_id: ids }, transaction, paranoid: false };
        const children = {
          where: { parent_id: ids },
          transaction,
          useMaster: true,
        };

        if (this.options.safeGuardDeletes) {
          const checkOptions = {
            transaction,
            useMaster: true,
            lock: true,
            attributes: ['id'],
          };
          const associated =
            (await RolePermission.findOne({ ...links, ...checkOptions })) ||
            (await RoleUser.findOne({ ...links, ...checkOptions })) ||
            (await GuardRole.findOne({ ...children, ...checkOptions }));
          if (associated) {
            throw new Error(
              'Cannot delete roles with associated memberships, permissions, or child roles',
            );
          }
        } else {
          // Explicit cleanup also applies when the role itself is soft-deleted.
          await RoleUser.destroy({ ...links, force: true });
          await RolePermission.destroy({ ...links, force: true });
          await GuardRole.update({ parent_id: null }, children);
        }

        const deleted = await GuardRole.destroy({
          where: { id: ids },
          transaction,
        });
        if (deleted) emitAfterCommit('onRolesDeleted', rolesToDelete);
        return deleted;
      },
    );
  };

  /**
   * Load all available roles and their permissions from the writer database.
   */
  SequelizeGuard.prototype.allRoles = async function (): Promise<
    GuardRoleModel[]
  > {
    return this._readCommitted(() =>
      this._models.GuardRole.findAll({
        include: 'Permissions',
        useMaster: true,
        transaction: null,
      }),
    );
  };

  /**
   * Load a role and its permissions from the writer database.
   */
  SequelizeGuard.prototype.getRole = async function (
    role: string,
  ): Promise<GuardRoleModel | null> {
    const name = normalizeRoleName(role);
    const result = await this._readCommitted(() =>
      this._models.GuardRole.findOne({
        where: { name },
        include: 'Permissions',
        useMaster: true,
        transaction: null,
      }),
    );
    return result?.name === name ? result : null;
  };

  /**
   * Find roles
   * @param args
   */
  SequelizeGuard.prototype.findRoles = async function (
    args: FindRolesArgs = {},
  ): Promise<GuardRoleModel[]> {
    const names = args.names?.length
      ? args.names
      : args.name
        ? [args.name]
        : [];
    const normalized = names.map(normalizeRoleName);
    const cond: FindOptions<InferAttributes<GuardRoleModel>> = {
      useMaster: true,
      transaction: null,
    };
    if (normalized.length) {
      cond.where = args.search
        ? {
            [Op.or]: normalized.map((name) => ({
              name: { [Op.substring]: name },
            })),
          }
        : { name: normalized };
    }
    if (args.withParent) cond.include = 'Parent';

    const roles = await this._readCommitted(() =>
      this._models.GuardRole.findAll(cond),
    );
    return args.search || !normalized.length
      ? roles
      : roles.filter((role) => normalized.includes(role.name));
  };

  /**
   * Add permissions to role
   * @param role
   * @param actions
   * @param resources
   * @param options
   */
  SequelizeGuard.prototype.addPermsToRole = async function (
    role: string | GuardRoleModel,
    actions: string | string[],
    resources: string | string[],
    options: PolicyMutationOptions = {},
  ): Promise<AddPermsToRoleResult> {
    const requested = permissionInputs(resources, actions);
    const roleData = makeRoleData(role);
    const guard = this as unknown as SequelizeGuard<Model>;
    return mutatePolicy(guard, options, async (mutation) => {
      const { transaction, emitAfterCommit } = mutation;
      const { role: target, created } =
        typeof role === 'string'
          ? await createRole(guard, roleData, transaction)
          : {
              role: await lockRoleInstance(guard, role, transaction),
              created: false,
            };
      if (created) emitAfterCommit('onRolesCreated', [target]);

      const assigned = await loadRolePermissions(guard, target, transaction);
      const grants = await createPermissions(guard, requested, mutation, {
        all: true,
      });
      const assignedIds = new Set(assigned.map((permission) => permission.id));
      const additions = grants.filter(
        (permission) => !assignedIds.has(permission.id),
      );

      await linkPermissions(guard, target, additions, transaction);
      target.Permissions = [...assigned, ...additions];
      if (additions.length) emitAfterCommit('onPermsAddedToRole', target);
      return { role: target, permissions: target.Permissions };
    });
  };

  /**
   * Subtract exact action tokens from the role's grants for the selected resources.
   */
  SequelizeGuard.prototype.rmPermsFromRole = async function (
    role: string,
    actions: string | string[],
    resources: string | string[],
    options: PolicyMutationOptions = {},
  ): Promise<RemovePermsFromRoleResult> {
    const name = normalizeRoleName(role);
    const requested = new Set(
      permissionInputs(resources, actions).map(
        (permission) => permission.resource,
      ),
    );
    const removedActions = new Set(canonicalPermissionActions(actions));
    const guard = this as unknown as SequelizeGuard<Model>;

    return mutatePolicy(guard, options, async (mutation) => {
      const { transaction, emitAfterCommit } = mutation;
      const [target] = await lockRoles(guard, [name], transaction);
      if (!target) return { role: null, permissions: [], permsRemoved: [] };

      const assigned = await loadRolePermissions(guard, target, transaction);
      const retained: GuardPermissionModel[] = [];
      const permsRemoved: GuardPermissionModel[] = [];
      const replacements: ReturnType<typeof makePermission>[] = [];

      for (const grant of assigned) {
        if (!requested.has(grant.resource)) {
          retained.push(grant);
          continue;
        }
        const grantActions = readPermissionActions(grant.action);
        if (!grantActions) {
          throw new Error(
            `Invalid actions in stored permission "${grant.name}"`,
          );
        }
        const remaining = grantActions.filter(
          (action) => !removedActions.has(action),
        );
        if (remaining.length === grantActions.length) {
          retained.push(grant);
          continue;
        }
        permsRemoved.push(grant);
        if (remaining.length) {
          replacements.push(
            makePermission(
              grant.resource,
              canonicalPermissionActions(remaining),
            ),
          );
        }
      }

      if (permsRemoved.length) {
        const residualGrants = await createPermissions(
          guard,
          replacements,
          mutation,
          { all: true },
        );
        const retainedIds = new Set(
          retained.map((permission) => permission.id),
        );
        const additions = residualGrants.filter(
          (permission) => !retainedIds.has(permission.id),
        );
        await this._models.RolePermission.destroy({
          where: {
            role_id: target.id,
            permission_id: permsRemoved.map((permission) => permission.id),
          },
          force: true,
          transaction,
        });
        await linkPermissions(guard, target, additions, transaction);
        retained.push(...additions);
        emitAfterCommit('onPermsRemovedFromRole', target);
      }

      target.Permissions = retained;
      return { role: target, permissions: retained, permsRemoved };
    });
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

export function normalizeRoleName(name: unknown): string {
  if (typeof name !== 'string' || !name.trim()) {
    throw new TypeError('Role name must be a non-empty string');
  }
  return name.trim().toLowerCase();
}

function makeRoleData(role: RoleCreationParam): RoleData {
  if (typeof role === 'string') return { name: normalizeRoleName(role) };
  return {
    name: normalizeRoleName(role?.name),
    description: role.description,
    parent_id: role.parent_id,
  };
}

export function roleInputs(roles: string | RoleCreationParam[]): RoleData[] {
  const values = typeof roles === 'string' ? [roles] : roles;
  const unique = new Map<string, RoleData>();
  for (const value of values) {
    const role = makeRoleData(value);
    if (!unique.has(role.name)) unique.set(role.name, role);
  }
  return [...unique.values()];
}

export async function createRole(
  guard: SequelizeGuard<Model>,
  roleData: RoleData,
  transaction: Transaction,
): Promise<RoleCreationResult> {
  const model = guard._models.GuardRole;
  const [role, created] = await findOrInsertPolicyRecord(
    model,
    {
      where: { name: roleData.name },
      transaction,
      lock: true,
      useMaster: true,
    },
    roleData,
  );
  if (role.name !== roleData.name) {
    throw new Error(
      `Role "${roleData.name}" conflicts with an existing role name`,
    );
  }
  return { role, created };
}

export async function createRoles(
  guard: SequelizeGuard<Model>,
  roles: RoleData[],
  { transaction, emitAfterCommit }: PolicyMutation,
  options: Pick<CreateRolesOptions, 'all'> = {},
): Promise<GuardRoleModel[]> {
  if (!roles.length) return [];
  const results = new Map<string, RoleCreationResult>();
  const ordered = [...roles].sort((a, b) => (a.name < b.name ? -1 : 1));
  for (const chunk of lodash.chunk(ordered, policyBatchSize)) {
    const names = chunk.map(({ name }) => name);
    for (const role of await lockRoles(guard, names, transaction)) {
      results.set(role.name, { role, created: false });
    }
    const fresh = chunk.filter(({ name }) => !results.has(name));
    for (const roleData of fresh) {
      results.set(roleData.name, await createRole(guard, roleData, transaction));
    }
  }

  const matches = roles.map(({ name }) => results.get(name)!);
  const created = matches
    .filter((result) => result.created)
    .map(({ role }) => role);
  if (created.length) emitAfterCommit('onRolesCreated', created);
  return options.all ? matches.map(({ role }) => role) : created;
}

export async function lockRoles(
  guard: SequelizeGuard<Model>,
  names: string[],
  transaction: Transaction,
): Promise<GuardRoleModel[]> {
  const roles = await guard._models.GuardRole.findAll({
    where: { name: names },
    order: [['name', 'ASC']],
    transaction,
    useMaster: true,
    lock: true,
  });
  const requested = new Set(names);
  return roles.filter((role) => requested.has(role.name));
}

async function lockRoleInstance(
  guard: SequelizeGuard<Model>,
  role: GuardRoleModel,
  transaction: Transaction,
): Promise<GuardRoleModel> {
  if (!(role instanceof guard._models.GuardRole)) {
    throw new TypeError('Expected a role from the guard role model');
  }
  const target = await guard._models.GuardRole.findByPk(role.id, {
    lock: true,
    transaction,
    useMaster: true,
  });
  if (!target) {
    throw new Error('Role does not exist on the guard connection');
  }
  return target;
}

async function loadRolePermissions(
  guard: SequelizeGuard<Model>,
  role: GuardRoleModel,
  transaction: Transaction,
): Promise<GuardPermissionModel[]> {
  const links = await guard._models.RolePermission.findAll({
    where: { role_id: role.id },
    transaction,
    useMaster: true,
    lock: true,
  });
  if (!links.length) return [];
  return guard._models.GuardPermission.findAll({
    where: { id: links.map((link) => link.permission_id) },
    transaction,
    useMaster: true,
    lock: transaction.LOCK.SHARE,
  });
}

async function linkPermissions(
  guard: SequelizeGuard<Model>,
  role: GuardRoleModel,
  permissions: GuardPermissionModel[],
  transaction: Transaction,
): Promise<void> {
  if (!permissions.length) return;
  const links = guard._models.RolePermission;
  let missing = permissions;
  if (canArchiveLinks(links)) {
    const previous = await links.findAll({
      where: {
        role_id: role.id,
        permission_id: permissions.map(({ id }) => id),
      },
      paranoid: false,
      transaction,
      useMaster: true,
      lock: true,
    });
    const existing = new Set(
      previous.map(({ permission_id }) => permission_id),
    );
    missing = permissions.filter(({ id }) => !existing.has(id));
    const archived = previous
      .filter((link) => link.isSoftDeleted())
      .map(({ id }) => id);
    if (archived.length) {
      await links.restore({ where: { id: archived }, transaction });
    }
  }
  if (missing.length) {
    await links.bulkCreate(
      missing.map((permission) => ({
        role_id: role.id,
        permission_id: permission.id,
      })),
      { transaction },
    );
  }
}
