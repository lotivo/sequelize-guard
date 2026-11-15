import type { Model } from 'sequelize';
import type { GuardRoleData, GuardUserModel } from '../sequelize-models';
import type { SequelizeGuard, SequelizeGuardType } from '../SequelizeGuard';
import type { PolicyMutationOptions } from '../types';
import { findOrInsertPolicyRecord, mutatePolicy } from './policyMutation';
import { createRoles, lockRoles, normalizeRoleName, roleInputs } from './Roles';

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
    const userId = getUserId(this, user);
    const requested = roleInputs(roles);
    if (!requested.length) return;

    await mutatePolicy(this, options, async (mutation) => {
      const { transaction } = mutation;
      const assigned = await createRoles(this, requested, mutation, {
        all: true,
      });
      for (const role of assigned) {
        const membership = { user_id: userId, role_id: role.id };
        await findOrInsertPolicyRecord(
          this._models.RoleUser,
          { where: membership, transaction, lock: true, useMaster: true },
          membership,
        );
      }
    });
  };

  /**
   * Remove roles from user.
   */
  SequelizeGuard.prototype.rmAssignedRoles = async function (
    user: Model,
    roles: string[],
    options: PolicyMutationOptions = {},
  ): Promise<void> {
    const userId = getUserId(this, user);
    const names = [...new Set(roles.map(normalizeRoleName))];
    if (!names.length) return;

    await mutatePolicy(this, options, async ({ transaction }) => {
      const rolesToRemove = await lockRoles(this, names, transaction);
      if (!rolesToRemove.length) return;
      await this._models.RoleUser.destroy({
        where: {
          user_id: userId,
          role_id: rolesToRemove.map((role) => role.id),
        },
        force: true,
        transaction,
      });
    });
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

function getUserId(guard: SequelizeGuard, user: Model) {
  const key = guard._models.GuardUser.primaryKeyAttribute;
  const id: unknown = getPolicyUser(guard, user).get(key);
  if (typeof id !== 'number' && typeof id !== 'string') {
    throw new TypeError('Guard user must have a string or numeric primary key');
  }
  return id;
}
