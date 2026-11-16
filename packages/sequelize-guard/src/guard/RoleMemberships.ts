import { Op } from 'sequelize';
import type { Model, ModelStatic, Transaction } from 'sequelize';
import type { GuardRoleUserModelStatic } from '../sequelize-models';
import type { SequelizeGuardInstance } from '../SequelizeGuard';
import type { PolicyMutationOptions, RoleAssignmentResult } from '../types';
import {
  canArchiveLinks,
  mutatePolicy,
  policyBatchSize,
} from './policyMutation';
import { lockRoleHierarchy } from './RoleHierarchy';
import { createRoles, lockRoles, normalizeRoleName } from './Roles';

export interface RoleMemberships {
  members: ModelStatic<Model>;
  links: GuardRoleUserModelStatic;
}

type MemberId = string | number;

export function memberId(model: ModelStatic<Model>, member: Model): MemberId {
  if (!(member instanceof model) || member.isNewRecord) {
    throw new TypeError('Expected a persisted member from the guard model');
  }
  const id: unknown = member.getDataValue(model.primaryKeyAttribute);
  if (
    typeof id === 'string' ||
    (typeof id === 'number' && Number.isSafeInteger(id))
  )
    return id;
  throw new TypeError('Expected a string or safe integer primary key');
}

export async function assignMemberships(
  guard: SequelizeGuardInstance,
  { members, links }: RoleMemberships,
  requests: readonly { member: Model; roles: readonly string[] }[],
  options: PolicyMutationOptions,
): Promise<RoleAssignmentResult> {
  const assignments = new Map<string, { id: MemberId; names: Set<string> }>();
  const names = new Set<string>();
  for (const { member, roles } of requests) {
    if (!Array.isArray(roles))
      throw new TypeError('Roles must be an array of names');
    const id = memberId(members, member);
    const key = String(id);
    const assignment = assignments.get(key) ?? { id, names: new Set<string>() };
    for (const role of roles) {
      const name = normalizeRoleName(role);
      names.add(name);
      assignment.names.add(name);
    }
    assignments.set(key, assignment);
  }
  if (!assignments.size) return { assigned: 0 };

  return mutatePolicy(guard, options, async (mutation) => {
    const { transaction } = mutation;
    if (names.size) await lockRoleHierarchy(guard, transaction);
    await assertActiveMembers(
      members,
      [...assignments.values()].map(({ id }) => id),
      transaction,
    );
    const roles = await createRoles(
      guard,
      [...names].map((name) => ({ name })),
      mutation,
      { all: true },
    );

    const ids = new Map(roles.map(({ name, id }) => [name, id]));
    const requested = [...assignments.values()].flatMap(({ id, names }) =>
      [...names].map((name) => ({ user_id: id, role_id: ids.get(name)! })),
    );
    let assigned = 0;
    for (const chunk of batches(requested)) {
      const previous = await links.findAll({
        where: { [Op.or]: chunk },
        paranoid: false,
        transaction,
        lock: true,
        useMaster: true,
      });
      const existing = new Set(previous.map(membershipKey));
      const missing = chunk.filter(
        (link) => !existing.has(membershipKey(link)),
      );
      const archived = canArchiveLinks(links)
        ? previous.filter((link) => link.isSoftDeleted()).map(({ id }) => id)
        : [];
      if (archived.length) {
        await links.restore({ where: { id: archived }, transaction });
      }
      if (missing.length) await links.bulkCreate(missing, { transaction });
      assigned += archived.length + missing.length;
    }
    return { assigned };
  });
}

export async function removeMemberships(
  guard: SequelizeGuardInstance,
  { members, links }: RoleMemberships,
  member: Model,
  roles: readonly string[],
  options: PolicyMutationOptions,
): Promise<void> {
  if (!Array.isArray(roles))
    throw new TypeError('Roles must be an array of names');
  const id = memberId(members, member);
  const names = [...new Set(roles.map(normalizeRoleName))];
  if (!names.length) return;

  await mutatePolicy(guard, options, async ({ transaction }) => {
    await lockRoleHierarchy(guard, transaction);
    const rolesToRemove = await lockRoles(guard, names, transaction);
    if (!rolesToRemove.length) return;
    await links.destroy({
      where: { user_id: id, role_id: rolesToRemove.map((role) => role.id) },
      force: true,
      transaction,
    });
  });
}

async function assertActiveMembers(
  model: ModelStatic<Model>,
  ids: MemberId[],
  transaction: Transaction,
) {
  const key = model.primaryKeyAttribute;
  for (const chunk of batches(ids)) {
    const active = await model.unscoped().findAll({
      attributes: [key],
      where: { [key]: chunk },
      order: [[key, 'ASC']],
      transaction,
      lock: true,
      useMaster: true,
    });
    const found = new Set(
      active.map((member) => String(memberId(model, member))),
    );
    if (chunk.some((id) => !found.has(String(id)))) {
      throw new Error('A role assignment member no longer exists');
    }
  }
}

function* batches<T>(values: readonly T[]) {
  for (let start = 0; start < values.length; start += policyBatchSize) {
    yield values.slice(start, start + policyBatchSize);
  }
}

function membershipKey(link: { user_id: MemberId; role_id: number }): string {
  return JSON.stringify([String(link.user_id), link.role_id]);
}
