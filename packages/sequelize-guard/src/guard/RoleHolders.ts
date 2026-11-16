import type { Model } from 'sequelize';
import { parsePermissionRequest } from '../authorize/permissionGrammar';
import {
  readMemberPermissions,
  readMemberRoles,
} from '../authorize/roleMembershipQuery';
import type { SequelizeGuard, SequelizeGuardType } from '../SequelizeGuard';
import type { PolicyMutationOptions } from '../types';
import { assignMemberships, removeMemberships } from './RoleMemberships';

export function extendWithRoleHolders(
  SequelizeGuard: SequelizeGuardType,
): void {
  SequelizeGuard.prototype.assignRolesToHolder = async function (
    holder: Model,
    roles: readonly string[],
    options: PolicyMutationOptions = {},
  ) {
    return assignMemberships(
      this,
      holderMemberships(this, holder),
      [{ member: holder, roles }],
      options,
    );
  };

  SequelizeGuard.prototype.removeRolesFromHolder = async function (
    holder: Model,
    roles: readonly string[],
    options: PolicyMutationOptions = {},
  ) {
    return removeMemberships(
      this,
      holderMemberships(this, holder),
      holder,
      roles,
      options,
    );
  };

  SequelizeGuard.prototype.getHolderRoles = async function (holder: Model) {
    return readMemberRoles(this, holderMemberships(this, holder), holder);
  };

  SequelizeGuard.prototype.holderCan = async function (
    holder: Model,
    permission: string,
  ) {
    if (!parsePermissionRequest(permission)) return false;
    const grants = await readMemberPermissions(
      this,
      holderMemberships(this, holder),
      holder,
    );
    return this.resolvePermission(grants, permission);
  };
}

function holderMemberships(guard: SequelizeGuard, holder: Model) {
  const membership = guard._roleHolders.get(holder?.constructor);
  if (!membership)
    throw new TypeError('Expected a registered role holder model');
  return membership;
}
