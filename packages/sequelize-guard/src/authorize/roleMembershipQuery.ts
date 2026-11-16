import { QueryTypes } from 'sequelize';
import type { Model, ModelStatic } from 'sequelize';
import { memberId } from '../guard/RoleMemberships';
import type { RoleMemberships } from '../guard/RoleMemberships';
import { normalizeRoleName } from '../guard/Roles';
import type { GuardRoleModel } from '../sequelize-models';
import { quoteGuardTable } from '../sequelize-models/guard-tables';
import type { SequelizeGuardInstance } from '../SequelizeGuard';

interface ActiveTable {
  table: string;
  active: string;
  column: (attribute: string) => string;
}

function activeTable(
  guard: SequelizeGuardInstance,
  model: ModelStatic<Model>,
  alias: string,
): ActiveTable {
  const query = guard.sequelize.getQueryInterface();
  const attributes = model.getAttributes();
  const column = (attribute: string) =>
    `${alias}.${query.quoteIdentifier(attributes[attribute].field || attribute, true)}`;
  const { deletedAt, paranoid, timestamps } = model.options;
  const deletedAttribute =
    typeof deletedAt === 'string' ? deletedAt : 'deletedAt';
  const deleted = attributes[deletedAttribute];

  let active = '1 = 1';
  if (paranoid && timestamps && deletedAt !== false && deleted) {
    const value = deleted.defaultValue;
    if (!value) {
      active = `${column(deletedAttribute)} IS NULL`;
    } else if (
      value instanceof Date ||
      typeof value === 'string' ||
      typeof value === 'number'
    ) {
      active = `${column(deletedAttribute)} = ${guard.sequelize.escape(value)}`;
    } else {
      throw new Error(
        'Unsupported dynamic paranoid timestamp default for role holder',
      );
    }
  }
  return {
    table: `${quoteGuardTable(query, model.getTableName())} AS ${alias}`,
    active,
    column,
  };
}

function directMemberships(
  guard: SequelizeGuardInstance,
  { members, links }: RoleMemberships,
  member: Model,
) {
  guard._assertModelBindings();
  const holder = activeTable(guard, members, 'principal');
  const link = activeTable(guard, links, 'membership');
  const role = activeTable(guard, guard._models.GuardRole, 'policy_role');
  const hierarchy = activeTable(guard, guard._roleHierarchy, 'role_hierarchy');
  const sql = `
    FROM ${holder.table}
    JOIN ${link.table}
      ON ${link.column('user_id')} = ${holder.column(members.primaryKeyAttribute)} AND ${link.active}
    JOIN ${role.table}
      ON ${role.column('id')} = ${link.column('role_id')} AND ${role.active}
    JOIN ${hierarchy.table}
      ON ${hierarchy.column('id')} = 1
      AND ${hierarchy.column('revision')} IN (0, 1)
      AND ${hierarchy.column('ownership')} LIKE $guardOwnership
    WHERE ${holder.column(members.primaryKeyAttribute)} = $holderId AND ${holder.active}`;
  return {
    role,
    sql,
    bind: {
      holderId: memberId(members, member),
      guardOwnership: guard._ownershipPattern,
    },
  };
}

export async function readMemberRoles(
  guard: SequelizeGuardInstance,
  memberships: RoleMemberships,
  member: Model,
): Promise<GuardRoleModel[]> {
  const direct = directMemberships(guard, memberships, member);
  const roles = await guard.sequelize.query(
    `SELECT policy_role.* ${direct.sql}`,
    {
      bind: direct.bind,
      model: guard._models.GuardRole,
      mapToModel: true,
      useMaster: true,
      transaction: null,
    },
  );
  assertCanonicalRoleNames(roles.map(({ name }) => name));
  return roles;
}

export async function readMemberPermissions(
  guard: SequelizeGuardInstance,
  memberships: RoleMemberships,
  member: Model,
  resource: string,
) {
  const direct = directMemberships(guard, memberships, member);
  const parent = activeTable(guard, guard._models.GuardRole, 'parent_role');
  const link = activeTable(
    guard,
    guard._models.RolePermission,
    'permission_link',
  );
  const permission = activeTable(
    guard,
    guard._models.GuardPermission,
    'policy_permission',
  );

  // DISTINCT bounds traversal of corrupt cycles. Only complete paths grant access.
  const rows = await guard.sequelize.query<
    | { role_name: string; action: null; resource: null }
    | { role_name: null; action: string; resource: string }
  >(
    `
    WITH RECURSIVE lineage (root_id, role_id, parent_id) AS (
      SELECT ${direct.role.column('id')}, ${direct.role.column('id')}, ${direct.role.column('parent_id')}
      ${direct.sql}
      UNION
      SELECT lineage.root_id, ${parent.column('id')}, ${parent.column('parent_id')}
      FROM lineage
      JOIN ${parent.table} ON ${parent.column('id')} = lineage.parent_id AND ${parent.active}
    ),
    valid_roles AS (
      SELECT DISTINCT role_id FROM lineage
      WHERE root_id IN (SELECT root_id FROM lineage WHERE parent_id IS NULL)
    )
    SELECT ${direct.role.column('name')} AS role_name, NULL AS action, NULL AS resource
    FROM valid_roles JOIN ${direct.role.table} ON ${direct.role.column('id')} = valid_roles.role_id
    UNION ALL
    SELECT NULL AS role_name, ${permission.column('action')} AS action, ${permission.column('resource')} AS resource
    FROM ${permission.table}
    WHERE ${permission.active}
      AND ${permission.column('resource')} IN ($resource, '*')
      AND ${permission.column('id')} IN (
      SELECT ${link.column('permission_id')} FROM ${link.table}
      WHERE ${link.active} AND ${link.column('role_id')} IN (SELECT role_id FROM valid_roles)
    )
  `,
    {
      bind: { ...direct.bind, resource },
      type: QueryTypes.SELECT,
      useMaster: true,
      transaction: null,
    },
  );
  assertCanonicalRoleNames(
    rows.flatMap(({ role_name }) => (role_name === null ? [] : [role_name])),
  );
  return rows.filter((row) => row.role_name === null);
}

function assertCanonicalRoleNames(names: string[]): void {
  for (const name of names) {
    if (name !== normalizeRoleName(name))
      throw new Error('Stored guard role name must be normalized');
  }
}
