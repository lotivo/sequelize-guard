var _ = require('lodash');
const NodeCache = require('node-cache');

module.exports = (SequelizeGuard) => {
  SequelizeGuard.prototype.resetUserCache = function () {
    if (!this._usercache) {
      this._usercache = new NodeCache();
    }
    this._usercache.flushAll();
    return this._usercache;
  };

  SequelizeGuard.prototype.getUserCache = async function () {
    if (this._usercache) {
      return this._usercache;
    } else {
      return this.resetUserCache();
    }
  };
};
