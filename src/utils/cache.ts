import { values } from 'lodash';
import NodeCache from 'node-cache';
import { GuardPermissionModel, GuardRoleModel } from '../sequelize-models';
import type { SequelizeGuard, SequelizeGuardType } from '../SequelizeGuard';

/**
 * Extended NodeCache with Guard-specific methods
 */
export class GuardCache extends NodeCache {
  getRoles(): Record<number, GuardRoleModel> {
    return this.get('roles') || {};
  }

  getPerms(): Record<number, GuardPermissionModel> {
    return this.get('perms') || {};
  }

  setRoles(roles: Record<number, GuardRoleModel>): boolean {
    return this.set('roles', roles);
  }

  setPerms(perms: Record<number, GuardPermissionModel>): boolean {
    return this.set('perms', perms);
  }

  async getRolesWithPerms(
    guard: SequelizeGuard,
  ): Promise<Record<number, GuardRoleModel>> {
    const cRoles = values(this.getRoles());
    const r2Fetch = cRoles
      .filter((role) => !role.Permissions)
      .map((role) => role.id);

    if (r2Fetch.length === 0) {
      return this.getRoles();
    }

    const roles = await guard.models().GuardRole.findAll({
      where: { id: r2Fetch },
      include: 'Permissions',
    });

    const mappedRoles = mappedRolesToIds(roles);
    const roles2Save = {
      ...this.getRoles(),
      ...mappedRoles,
    };

    this.setRoles(roles2Save);
    return roles2Save;
  }
}

/**
 * Map permissions to IDs
 * @param objects
 */
function mappedPermsToIds(
  objects: GuardPermissionModel[],
): Record<number, GuardPermissionModel> {
  const mappedObj: Record<number, GuardPermissionModel> = {};

  if (!objects) {
    return mappedObj;
  }

  objects.forEach((obj) => {
    mappedObj[obj['id']] = obj.toJSON ? obj.toJSON() : obj;
  });

  return mappedObj;
}

/**
 * Map roles to IDs with permissions
 * @param objects
 */
function mappedRolesToIds(
  objects: GuardRoleModel[],
): Record<number, GuardRoleModel> {
  const mappedObj: Record<number, GuardRoleModel> = {};

  if (!objects.length) {
    return mappedObj;
  }

  objects.forEach((obj) => {
    if (!obj.Permissions) {
      obj.Permissions = [];
    }

    // if (obj.dataValues) {
    //   obj.dataValues.getPermissions = obj.Permissions;
    // }

    mappedObj[obj['id']] = obj;
  });

  return mappedObj;
}

/**
 * Extend SequelizeGuard with cache methods
 * @param SequelizeGuard
 */
export function extendWithCache(SequelizeGuard: SequelizeGuardType): void {
  /**
   * Reset and initialize cache
   */
  SequelizeGuard.prototype.resetCache = function (): GuardCache {
    if (!this._cache) {
      this._cache = new GuardCache();
    }
    this._cache.flushAll();
    return this._cache;
  };

  /**
   * Get or create cache instance
   */
  SequelizeGuard.prototype.getCache = async function (): Promise<GuardCache> {
    if (!this._cache) {
      const cache = this.resetCache();
      this._cache = cache;

      try {
        const roles = await this.models().GuardRole.findAll({
          include: 'Permissions',
        });

        const mappedRoles = mappedRolesToIds(roles);

        const perms = await this.models().GuardPermission.findAll();
        const mappedPerms = mappedPermsToIds(perms);

        cache.setRoles(mappedRoles);
        cache.setPerms(mappedPerms);

        bindGuardListeners(this);
      } catch (error) {
        console.log(`
          ====================================
          '\tTables for Guard not created, make sure you have run migrations or enabled sync option',

          ERROR: ${
            (error as Error).message ||
            'Unknown error during cache initialization'
          }
          ====================================
          `);
      }
    }

    return this._cache;
  };
}

/**
 * Bind event listeners to keep cache in sync
 * @param guard
 */
function bindGuardListeners(guard: SequelizeGuard): void {
  const cache = guard._cache as GuardCache;

  guard.onRolesCreated((roles) => {
    const rolesData = roles.map((role) => {
      const r = role;
      r.Permissions = [];
      return r;
    });

    const mappedRoles = mappedRolesToIds(rolesData);
    cache.setRoles({
      ...cache.getRoles(),
      ...mappedRoles,
    });
  });

  guard.onRolesDeleted((roles) => {
    const existRoles = cache.getRoles();
    roles.forEach((role) => delete existRoles[role.id]);
    cache.setRoles(existRoles);
  });

  guard.onPermsCreated((perms: GuardPermissionModel[]) => {
    const mappedPerms = mappedPermsToIds(perms);
    cache.setPerms({
      ...cache.getPerms(),
      ...mappedPerms,
    });
  });

  guard.onPermsAddedToRole((role) => {
    const roles = [role];
    const mappedRoles = mappedRolesToIds(roles);
    cache.setRoles({
      ...cache.getRoles(),
      ...mappedRoles,
    });
  });

  guard.onPermsRemovedFromRole((role) => {
    const roles = [role];
    const mappedRoles = mappedRolesToIds(roles);
    cache.setRoles({
      ...cache.getRoles(),
      ...mappedRoles,
    });
  });
}
