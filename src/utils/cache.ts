import NodeCache from 'node-cache';
import { values } from 'lodash';
import type { SequelizeGuard } from '../SequelizeGuard';
import type { GuardRoleModel, GuardPermissionModel } from '../types';

declare module '../SequelizeGuard' {
  interface SequelizeGuard {
    resetCache(): GuardCache;
    getCache(): Promise<GuardCache>;
  }
}

/**
 * Extended NodeCache with Guard-specific methods
 */
export class GuardCache extends NodeCache {
  getRoles(): Record<number, any> {
    return this.get('roles') || {};
  }

  getPerms(): Record<number, any> {
    return this.get('perms') || {};
  }

  setRoles(roles: Record<number, any>): boolean {
    return this.set('roles', roles);
  }

  setPerms(perms: Record<number, any>): boolean {
    return this.set('perms', perms);
  }

  async getRolesWithPerms(guard: SequelizeGuard): Promise<Record<number, any>> {
    const cRoles = values(this.getRoles());
    const r2Fetch = cRoles
      .filter((role) => !role.Permissions)
      .map((role) => role.id);

    if (r2Fetch.length === 0) {
      return this.getRoles();
    }

    const roles = await guard.models().GuardRole.findAll({
      where: { id: r2Fetch },
      include: 'Permissions' as any,
    });

    const mappedRoles = mappedRolesToIds(roles as any);
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
 */
function mappedPermsToIds(
  objects: GuardPermissionModel[],
  id: string = 'id',
): Record<number, any> {
  if (!objects) return {};
  const mappedObj: Record<number, any> = {};

  objects.forEach((obj) => {
    mappedObj[(obj as any)[id]] = obj.toJSON ? obj.toJSON() : obj;
  });

  return mappedObj;
}

/**
 * Map roles to IDs with permissions
 */
function mappedRolesToIds(
  objects: any[],
  id: string = 'id',
): Record<number, any> {
  if (!objects) return {};
  const mappedObj: Record<number, any> = {};

  objects.forEach((obj) => {
    if (!obj.Permissions) {
      obj.Permissions = false;
    }

    if (obj.dataValues) {
      obj.dataValues.Permissions = obj.Permissions;
    }

    mappedObj[obj[id]] = obj;
  });

  return mappedObj;
}

/**
 * Extend SequelizeGuard with cache methods
 */
export function extendWithCache(
  SequelizeGuard: typeof import('../SequelizeGuard').SequelizeGuard,
): void {
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
    return new Promise(async (resolve) => {
      if (!this._cache) {
        const cache = this.resetCache();

        try {
          const roles = await this.models().GuardRole.findAll({
            include: 'Permissions' as any,
          });

          const mappedRoles = mappedRolesToIds(roles as any);

          const perms = await this.models().GuardPermission.findAll();
          const mappedPerms = mappedPermsToIds(perms as any);

          cache.setRoles(mappedRoles);
          cache.setPerms(mappedPerms);

          bindGuardListeners(this);
        } catch (error) {
          console.log('====================================');
          console.log(
            '\tTables for Guard not created, make sure you have run migrations or enabled sync option',
          );
          console.log('====================================');
        }
      }
      resolve(this._cache as GuardCache);
    });
  };
}

/**
 * Bind event listeners to keep cache in sync
 */
function bindGuardListeners(guard: SequelizeGuard): void {
  const cache = guard._cache as GuardCache;

  (guard as any).onRolesCreated((roles: any[]) => {
    const rolesData = roles.map((role) => {
      const r = role as any;
      r.Permissions = false;
      if (r.dataValues) {
        r.dataValues.Permissions = false;
      }
      return r;
    });

    const mappedRoles = mappedRolesToIds(rolesData);
    cache.setRoles({
      ...cache.getRoles(),
      ...mappedRoles,
    });
  });

  (guard as any).onRolesDeleted((roles: any[]) => {
    const existRoles = cache.getRoles();
    roles.forEach((role) => delete existRoles[role.id]);
    cache.setRoles(existRoles);
  });

  (guard as any).onPermsCreated((perms: GuardPermissionModel[]) => {
    const mappedPerms = mappedPermsToIds(perms);
    cache.setPerms({
      ...cache.getPerms(),
      ...mappedPerms,
    });
  });

  (guard as any).onPermsAddedToRole((role: any) => {
    const roles = [role];
    const mappedRoles = mappedRolesToIds(roles);
    cache.setRoles({
      ...cache.getRoles(),
      ...mappedRoles,
    });
  });

  (guard as any).onPermsRemovedFromRole((role: any) => {
    const roles = [role];
    const mappedRoles = mappedRolesToIds(roles);
    cache.setRoles({
      ...cache.getRoles(),
      ...mappedRoles,
    });
  });
}
