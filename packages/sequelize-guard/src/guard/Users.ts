import type { Model } from 'sequelize';
import type { GuardRoleData, GuardUserModel } from '../sequelize-models';
import type { SequelizeGuard, SequelizeGuardType } from '../SequelizeGuard';
import type { PolicyMutationOptions, UserRoleAssignment } from '../types';
import { mutatePolicy } from './policyMutation';
import { assignMemberships, removeMemberships } from './RoleMemberships';

/**
 * Extend SequelizeGuard with user management methods
 * @param SequelizeGuard
 */
export function extendWithUsers(SequelizeGuard: SequelizeGuardType): void {
  /**
   * Make/create a user
   */
  SequelizeGuard.prototype.makeUser = async function (
    options: PolicyMutationOptions = {},
  ) {
    return mutatePolicy(this, options, ({ transaction }) =>
      this._models.GuardUser.create({}, { transaction }),
    );
  };

  /**
   * Assign role to user.
   */
  SequelizeGuard.prototype.assignRole = async function <TUser extends Model>(
    user: TUser,
    role: string,
    options: PolicyMutationOptions = {},
  ): Promise<TUser> {
    await this.assignRoles(user, [role], options);
    return user;
  };

  /**
   * Assign roles and create any missing roles in the same transaction.
   */
  SequelizeGuard.prototype.assignRoles = async function (
    user: Model,
    roles: string[],
    options: PolicyMutationOptions = {},
  ): Promise<void> {
    await this.assignUserRoles([{ user, roles }], options);
  };

  SequelizeGuard.prototype.assignRolesToUsers = async function (
    users: readonly Model[],
    roles: readonly string[],
    options: PolicyMutationOptions = {},
  ) {
    return this.assignUserRoles(
      users.map((user) => ({ user, roles })),
      options,
    );
  };

  SequelizeGuard.prototype.assignUserRoles = async function (
    assignments: readonly UserRoleAssignment[],
    options: PolicyMutationOptions = {},
  ) {
    return assignMemberships(
      this,
      userMemberships(this),
      assignments.map(({ user, roles }) => ({
        member: getPolicyUser(this, user),
        roles,
      })),
      options,
    );
  };

  /** Remove direct memberships from a user. */
  SequelizeGuard.prototype.rmAssignedRoles = async function (
    user: Model,
    roles: string[],
    options: PolicyMutationOptions = {},
  ) {
    return removeMemberships(
      this,
      userMemberships(this),
      getPolicyUser(this, user),
      roles,
      options,
    );
  };

  /**
   * Get current user roles from the database.
   */
  SequelizeGuard.prototype.getUserRoles = async function (
    user: Model,
  ): Promise<GuardRoleData[]> {
    const roles = await getPolicyUser(this, user).getRoles!({
      useMaster: true,
      transaction: null,
    });
    return roles.map((role) => role.toJSON());
  };
}

export function getPolicyUser(
  guard: SequelizeGuard,
  user: Model,
): GuardUserModel {
  if (!(user instanceof guard._models.GuardUser) || user.isNewRecord) {
    throw new TypeError('Expected a persisted user from the guard user model');
  }
  return user as GuardUserModel;
}

export function userMemberships(guard: SequelizeGuard) {
  const { GuardUser, RoleUser } = guard._models;
  return { members: GuardUser, links: RoleUser };
}
