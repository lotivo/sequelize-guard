import NodeCache from 'node-cache';

declare module '../SequelizeGuard' {
  interface SequelizeGuard {
    resetUserCache(): GuardUserCache;
    getUserCache(): GuardUserCache;
  }
}

/**
 * User-specific cache for storing user roles
 */
export class GuardUserCache extends NodeCache {
  constructor(ttl: number = 60) {
    super({ stdTTL: ttl });
  }
}

/**
 * Extend SequelizeGuard with user cache methods
 */
export function extendWithUserCache(
  SequelizeGuard: typeof import('../SequelizeGuard').SequelizeGuard,
): void {
  /**
   * Reset user cache
   */
  SequelizeGuard.prototype.resetUserCache = function (): GuardUserCache {
    if (!this._userCache) {
      this._userCache = new GuardUserCache(this.options.userCacheTtl);
    }
    this._userCache.flushAll();
    return this._userCache;
  };

  /**
   * Get or create user cache
   */
  SequelizeGuard.prototype.getUserCache = function (): GuardUserCache {
    if (this._userCache) {
      return this._userCache;
    }
    return this.resetUserCache();
  };
}
