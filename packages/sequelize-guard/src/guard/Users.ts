import lodash from 'lodash';
import type { Model, ModelStatic, Transaction } from 'sequelize';
import type { GuardRoleData, GuardUserModel } from '../sequelize-models';
import type { SequelizeGuard, SequelizeGuardType } from '../SequelizeGuard';
import type { PolicyMutationOptions } from '../types';
import {
  canArchiveLinks,
  mutatePolicy,
  policyBatchSize,
} from './policyMutation';
import { createRoles, lockRoles, normalizeRoleName } from './Roles';

type UserId = string | number;

function getUserId(model: ModelStatic<Model>, user: Model): UserId {
  if (!(user instanceof model) || user.isNewRecord) {
    throw new TypeError('Expected a persisted user from the guard user model');
  }
  const id: unknown = user.getDataValue(model.primaryKeyAttribute);
  if (
    typeof id === 'string' ||
    (typeof id === 'number' && Number.isSafeInteger(id))
  ) {
    return id;
  }
  throw new TypeError('Expected a string or safe integer primary key');
}

async function assertActiveUser(
  model: ModelStatic<Model>,
  id: UserId,
  transaction: Transaction,
): Promise<void> {
  const key = model.primaryKeyAttribute;
  const found = await model.unscoped().findOne({
    attributes: [key],
    where: { [key]: id },
    transaction,
    lock: true,
    useMaster: true,
  });
  if (!found) {
    throw new Error('A role assignment user no longer exists');
  }
}

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
    return mutatePolicy(
      this as unknown as SequelizeGuard<Model>,
      options,
      ({ transaction }) =>
        this._models.GuardUser.create({}, { transaction }),
    );
  };

  /**
   * Assign role to user
   * @param user
   * @param role
   * @param options
   */
  SequelizeGuard.prototype.assignRole = async function (
    user: GuardUserModel,
    role: string,
    options: PolicyMutationOptions = {},
  ): Promise<GuardUserModel> {
    await this.assignRoles(user, [role], options);
    return user;
  };

  /**
   * Assign multiple roles to user
   * @param user
   * @param roles
   * @param options
   */
  SequelizeGuard.prototype.assignRoles = async function (
    user: GuardUserModel,
    roles: string[],
    options: PolicyMutationOptions = {},
  ): Promise<void> {
    if (!Array.isArray(roles)) {
      throw new TypeError('Roles must be an array of names');
    }
    const guard = this as unknown as SequelizeGuard<Model>;
    const { GuardUser, RoleUser } = guard._models;
    const id = getUserId(GuardUser, user);
    const names = [...new Set(roles.map(normalizeRoleName))];
    if (!names.length) return;

    await mutatePolicy(guard, options, async (mutation) => {
      const { transaction } = mutation;
      await assertActiveUser(GuardUser, id, transaction);
      const roleModels = await createRoles(
        guard,
        names.map((name) => ({ name })),
        mutation,
        { all: true },
      );

      for (const chunk of lodash.chunk(roleModels, policyBatchSize)) {
        const roleIds = chunk.map((role) => role.id);
        const previous = await RoleUser.findAll({
          where: { user_id: id, role_id: roleIds },
          paranoid: false,
          transaction,
          lock: true,
          useMaster: true,
        });
        const existing = new Set(previous.map((link) => link.role_id));
        const missing = roleIds.filter((roleId) => !existing.has(roleId));
        const archived = canArchiveLinks(RoleUser)
          ? previous
              .filter((link) => link.isSoftDeleted())
              .map(({ id: linkId }) => linkId)
          : [];
        if (archived.length) {
          await RoleUser.restore({ where: { id: archived }, transaction });
        }
        if (missing.length) {
          await RoleUser.bulkCreate(
            missing.map((roleId) => ({ user_id: id, role_id: roleId })),
            { transaction },
          );
        }
      }
    });
  };

  /**
   * Remove roles from user
   * @param user
   * @param roles
   * @param options
   */
  SequelizeGuard.prototype.rmAssignedRoles = async function (
    user: GuardUserModel,
    roles: string[],
    options: PolicyMutationOptions = {},
  ): Promise<void> {
    if (!Array.isArray(roles)) {
      throw new TypeError('Roles must be an array of names');
    }
    const guard = this as unknown as SequelizeGuard<Model>;
    const { GuardUser, RoleUser } = guard._models;
    const id = getUserId(GuardUser, user);
    const names = [...new Set(roles.map(normalizeRoleName))];
    if (!names.length) return;

    await mutatePolicy(guard, options, async ({ transaction }) => {
      const rolesToRemove = await lockRoles(guard, names, transaction);
      if (!rolesToRemove.length) return;
      await RoleUser.destroy({
        where: {
          user_id: id,
          role_id: rolesToRemove.map((role) => role.id),
        },
        force: true,
        transaction,
      });
    });
  };

  /**
   * Get current user roles from the database
   * @param user
   */
  SequelizeGuard.prototype.getUserRoles = async function (
    user: GuardUserModel,
  ): Promise<GuardRoleData[]> {
    const roles = await this._readCommitted(() =>
      user.getRoles!({ useMaster: true, transaction: null }),
    );
    return roles.map((role) => role.toJSON());
  };
}
