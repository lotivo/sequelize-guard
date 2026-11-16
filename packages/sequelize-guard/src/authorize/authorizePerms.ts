import { Op } from 'sequelize';
import { GuardUserModel } from '../sequelize-models';
import type { SequelizeGuardType } from '../SequelizeGuard';

/**
 * Extend SequelizeGuard with permission-based authorization
 * @param SequelizeGuard
 */
export function extendWithAuthorizePerms(
  SequelizeGuard: SequelizeGuardType,
): void {
  /**
   * Check if user has permission
   * @param user
   * @param permission
   */
  SequelizeGuard.prototype.userCan = async function (
    user: GuardUserModel,
    permission: string,
  ): Promise<boolean> {
    const requested = parseRequest(permission);
    if (!requested) return false;
    // Keep the membership and matching grants in one writer-backed read.
    const roles = await this.committedReads.read(() =>
      user.getRoles!({
        include: [
          {
            association: 'Permissions',
            required: false,
            where: { resource: { [Op.in]: [requested.resource, '*'] } },
          },
        ],
        useMaster: true,
        transaction: null,
      }),
    );
    return roles.some((role) =>
      this.resolvePermission(role.Permissions ?? [], permission),
    );
  };

  /**
   * Check if user doesn't have permission
   * @param user
   * @param permission
   */
  SequelizeGuard.prototype.userCant = async function (
    user: GuardUserModel,
    permission: string,
  ): Promise<boolean> {
    return this.userCan(user, permission).then((result) => !result);
  };

  /**
   * Resolve permission from given permissions
   * @param givenPermissions
   * @param wantedPermission
   */
  SequelizeGuard.prototype.resolvePermission = function (
    givenPermissions,
    wantedPermission,
  ) {
    const requested = parseRequest(wantedPermission);
    if (!requested) return false;
    return givenPermissions.some(({ resource, action }) => {
      if (
        !validToken(resource) ||
        (resource !== '*' && resource !== requested.resource)
      )
        return false;
      let parsed: unknown;
      try {
        parsed = JSON.parse(action);
      } catch {
        return false;
      }
      return (
        Array.isArray(parsed) &&
        parsed.every(validToken) &&
        (parsed.includes('*') || parsed.includes(requested.action))
      );
    });
  };
}

function validToken(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    (value === '*' || /^[A-Za-z0-9][A-Za-z0-9_:.-]*$/.test(value))
  );
}

function parseRequest(
  value: string,
): { action: string; resource: string } | null {
  if (value === '*') return { action: '*', resource: '*' };
  if (typeof value !== 'string') return null;
  const parts = value.split(' ');
  return parts.length === 2 && parts.every(validToken)
    ? { action: parts[0], resource: parts[1] }
    : null;
}
