import lodash from 'lodash';
import { Op } from 'sequelize';
import { GuardRoleData, GuardUserModel } from '../sequelize-models';
import type { SequelizeGuardType } from '../SequelizeGuard';

/**
 * Extend SequelizeGuard with user management methods
 * @param SequelizeGuard
 */
export function extendWithUsers(SequelizeGuard: SequelizeGuardType): void {
  /**
   * Make/create a user
   */
  SequelizeGuard.prototype.makeUser = async function () {
    this._assertModelBindings();
    return this._models.GuardUser.create({});
  };

  /**
   * Assign role to user
   * @param user
   * @param role
   */
  SequelizeGuard.prototype.assignRole = async function (
    user: GuardUserModel,
    role: string,
  ): Promise<GuardUserModel> {
    this._assertModelBindings();
    const { role: roleModel } = await this.makeRole(role);
    await user.addRole!(roleModel.id);
    return user;
  };

  /**
   * Assign multiple roles to user
   * @param user
   * @param roles
   */
  SequelizeGuard.prototype.assignRoles = async function (
    user: GuardUserModel,
    roles: string[],
  ): Promise<void> {
    this._assertModelBindings();
    const allRoles = await this.makeRoles(roles, { all: true });
    const assignedRoles = await user.getRoles!();
    const roles2insert = lodash.differenceBy(
      allRoles,
      assignedRoles,
      (r) => r.name,
    );
    await user.addRoles!(roles2insert.map((r) => r.id));
  };

  /**
   * Remove roles from user
   * @param user
   * @param roles
   */
  SequelizeGuard.prototype.rmAssignedRoles = async function (
    user: GuardUserModel,
    roles: string[],
  ): Promise<void> {
    this._assertModelBindings();
    const rolesToRemove = await this._models.GuardRole.findAll({
      where: { name: { [Op.in]: roles } },
      useMaster: true,
    });
    await user.removeRoles!(rolesToRemove);
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
