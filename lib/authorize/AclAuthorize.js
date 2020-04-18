var _ = require('lodash');


module.exports = (SequelizeAcl) => {

  // Authorize.prototype.isGuest = function(){
  //   return !!this._user;
  // }

  /**
   * 
   * @name can
   * 
   * @param {string} user - action resource separated by space, eg. 'read blog'
   * @param {string} permission - action resource separated by space, eg. 'read blog'
   */
  SequelizeAcl.prototype.can = async function(user, permissionAsked){
    
    
    return user.getRoles().then(roles => {

      return firstTrue(
        roles.map(role => {
          return role.getPermissions().then(permissions => {

            return this.resolvePermission(permissions, permissionAsked)
          });
        })
      );
    })
  }

  function firstTrue(promises) {
    const newPromises = promises.map(p => new Promise(
        (resolve, reject) => p.then(v => v && resolve(true), reject)
    ));
    newPromises.push(Promise.all(promises).then(() => false));
    return Promise.race(newPromises);
  }

  SequelizeAcl.prototype.resolvePermission = function (givenPermissions, wantedPermission){
    const allSymbol = '*';
    if(wantedPermission === '*') wantedPermission = '* *';
    let wPerms = wantedPermission.split(" ");
    let wAction = wPerms[0];
    let wResource = wPerms[1];

    let gA = [], gR = []; 
    givenPermissions.forEach(p => {
      gA.push(JSON.parse(p.action));
      gR.push(p.resource)
    })

    for (var i=0; i <= gR.length; i++){
      if(
        (gR[i] === allSymbol && (gA[i].includes('*') || gA[i].includes(wAction))) ||
        (gR[i] === wResource && (gA[i].includes('*') || gA[i].includes(wAction)))
      ) return true;
    }

    return false;
  }

  
  
};
