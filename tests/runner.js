var Sequelize = require('sequelize');
var SequelizeAcl = require('../lib/index')
    , tests = require('./tests')

var schemas = require('../lib/migrations/acl-schema').schemas;

describe('Sequelize ACL - SQLite', function () {

    var dbConfig = {
        dialect: 'sqlite',
        logging: false,
        // storage: './seql-acl-testd5.sqlite3',
    }

    it('should make acl object',   function(done){
        let self = this;

        let seq = new Sequelize({ dialect: 'sqlite',logging: false, });        
        seq.authenticate().then(function() {

            let AclUser = seq.define("User", schemas['users'], {tableName : `acl_users`});

            let acl4 =  new SequelizeAcl(seq, {sync : false, debug: false, timestamps : true, paranoid : true, userModel: AclUser});
            self.acl2 =  new SequelizeAcl(seq, {sync : true, debug: true, timestamps : true, paranoid : false});
            done();
        });
    });

    before(function (done) {
        let self = this;
        let seq = new Sequelize(dbConfig);
        
        seq.authenticate().then(function() {
            return seq.drop().then(function() {
                self.acl = new SequelizeAcl(seq, {});
    
                done();
                
            });
        }).catch(done);
    })

    run();
})

function run() {
    Object.keys(tests).forEach(function (test) {
        tests[test]()
    })
}
