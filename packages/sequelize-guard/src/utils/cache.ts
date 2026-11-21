import lodash from 'lodash';
import NodeCache from 'node-cache';
import { GuardPermissionModel, GuardRoleModel } from '../sequelize-models';
import type { SequelizeGuard, SequelizeGuardType } from '../SequelizeGuard';
import type { GuardPermissionData } from '../types';

/**
 * Extended NodeCache with Guard-specific methods
 */
export class GuardCache extends NodeCache {
  getRoles(): Record<number, GuardRoleModel> {
    return this.get('roles') || {};
  }

  /** Cached permissions are plain attribute data. */
  getPerms(): Record<number, GuardPermissionData> {
    return this.get('perms') || {};
  }

  setRoles(roles: Record<number, GuardRoleModel>): boolean {
    return this.set('roles', roles);
  }

  setPerms(perms: Record<number, GuardPermissionData>): boolean {
    return this.set('perms', perms);
  }

  async getRolesWithPerms(
    guard: SequelizeGuard,
  ): Promise<Record<number, GuardRoleModel>> {
    guard._assertModelBindings();
    const cRoles = lodash.values(this.getRoles());
    const r2Fetch = cRoles
      .filter((role) => !role.Permissions)
      .map((role) => role.id);

    if (r2Fetch.length === 0) {
      return this.getRoles();
    }

    const roles = await guard._readCommitted(() =>
      guard.models().GuardRole.findAll({
        where: { id: r2Fetch },
        include: 'Permissions',
        useMaster: true,
        transaction: null,
      }),
    );

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
): Record<number, GuardPermissionData> {
  const mappedObj: Record<number, GuardPermissionData> = {};

  if (!objects) {
    return mappedObj;
  }

  objects.forEach((obj) => {
    mappedObj[obj['id']] = obj.toJSON<GuardPermissionData>();
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
      bindGuardListeners(this as unknown as SequelizeGuard);
    }
    this._cache.flushAll();
    this._cacheReady = undefined;
    return this._cache;
  };

  /**
   * Get or create cache instance
   */
  SequelizeGuard.prototype.getCache = async function (): Promise<GuardCache> {
    this._assertModelBindings();
    const cache = this._cache ?? this.resetCache();
    if (!this._cacheReady) {
      const initialization = Promise.resolve()
        .then(async () => {
          const { mappedRoles, mappedPerms } = await this._readCommitted(
            async () => {
              const roles = await this.models().GuardRole.findAll({
                include: 'Permissions',
                useMaster: true,
                transaction: null,
              });
              const perms = await this.models().GuardPermission.findAll({
                useMaster: true,
                transaction: null,
              });
              return {
                mappedRoles: mappedRolesToIds(roles),
                mappedPerms: mappedPermsToIds(perms),
              };
            },
          );

          // A reset supersedes an in-flight snapshot.
          if (this._cacheReady !== initialization) return this.getCache();
          cache.setRoles(mappedRoles);
          cache.setPerms(mappedPerms);
          return cache;
        })
        .catch((error: unknown) => {
          if (this._cacheReady === initialization) this._cacheReady = undefined;
          throw error;
        });
      this._cacheReady = initialization;
    }

    return this._cacheReady;
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
