var _ = require('lodash');

module.exports = (SequelizeAcl) => {
  // Authorize.prototype.isGuest = function(){
  //   return !!this._user;
  // }

  /**
  @name userHasRoles

  @param {object} _user
  @param {string} _roles
  */
  SequelizeAcl.prototype.userHasRoles = async function (_user, _roles) {
    return this.getUserRoles(_user)
      .then((roles) => roles.map((r) => r.name))
      .then((uRoles) => uRoles.map((r) => _.includes(_roles, r)))
      .then((checks) => _.includes(checks, true));
  };

  /**
  @name userHasRoles

  @param {object} _user
  @param {string} _roles
  */
  SequelizeAcl.prototype.userHasAllRoles = async function (_user, _roles) {
    return this.getUserRoles(_user)
      .then((roles) => roles.map((r) => r.name))
      .then((uRoles) => {
        return uRoles.length >= _roles.length
          ? uRoles.map((r) => _.includes(_roles, r))
          : _roles.map((r) => _.includes(uRoles, r));
      })
      .then((checks) => !_.includes(checks, false));
  };

  /**
  @name userHasRoles

  @param {object} _user
  @param {string} _roles
  */
  SequelizeAcl.prototype.userIsA = async function (_user, _role) {
    return this.getUserRoles(_user)
      .then((uRoles) => uRoles.map((r) => _role === r.name))
      .then((checks) => _.includes(checks, true));
  };
};
