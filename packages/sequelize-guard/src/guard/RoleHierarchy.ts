import { literal, Op } from 'sequelize';
import type { Transaction } from 'sequelize';
import type { SequelizeGuardInstance } from '../SequelizeGuard';

export async function lockRoleHierarchy(
  guard: SequelizeGuardInstance,
  transaction: Transaction,
): Promise<void> {
  guard._assertModelBindings();
  // A write makes PostgreSQL reject stale repeatable-read snapshots.
  const [locked] = await guard._roleHierarchy.update(
    { revision: literal('1 - revision') },
    {
      where: {
        id: 1,
        revision: [0, 1],
        ownership: { [Op.like]: guard._ownershipPattern },
      },
      transaction,
    },
  );
  if (locked !== 1) throw new Error('Guard role hierarchy is not initialized');
}

export async function assertRoleParent(
  guard: SequelizeGuardInstance,
  roleId: number | undefined,
  parentId: number,
  transaction: Transaction,
): Promise<void> {
  if (!Number.isSafeInteger(parentId)) {
    throw new TypeError('Parent role ID must be a safe integer');
  }
  const roles = await guard._models.GuardRole.findAll({
    attributes: ['id', 'parent_id'],
    transaction,
    useMaster: true,
    lock: true,
  });
  assertParentChain(roles, roleId, parentId);
}

interface RoleParent {
  id: number;
  parent_id?: number | null;
}

function assertParentChain(
  roles: RoleParent[],
  roleId: number | undefined,
  parentId: number,
): void {
  const byId = new Map(roles.map((role) => [role.id, role]));
  const visited = new Set<number>();
  let next: number | null | undefined = parentId;
  while (next != null) {
    if (next === roleId) throw new Error('Role parent would create a cycle');
    if (visited.has(next))
      throw new Error('Parent role hierarchy contains a cycle');
    const role = byId.get(next);
    if (!role) throw new Error('Parent role does not exist');
    visited.add(next);
    next = role.parent_id;
  }
}

export function assertRoleForest(roles: RoleParent[]): void {
  const byId = new Map(roles.map((role) => [role.id, role]));
  const verified = new Set<number>();
  for (const { id } of roles) {
    const path = new Set<number>();
    let next: number | null | undefined = id;
    while (next != null && !verified.has(next)) {
      if (path.has(next))
        throw new Error('Parent role hierarchy contains a cycle');
      const role = byId.get(next);
      if (!role || !Number.isSafeInteger(next)) {
        throw new Error(
          'Parent role does not exist or has an invalid identifier',
        );
      }
      path.add(next);
      next = role.parent_id;
    }
    for (const id of path) verified.add(id);
  }
}
