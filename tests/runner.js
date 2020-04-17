var Sequelize = require('sequelize');
var SequelizeAcl = require('../lib/index')
    , tests = require('./tests')

var schemas = require('../lib/migrations/acl-schema').schemas;

describe('Sequelize ACL - SQLite', function () {

    var dbConfig = {
        dialect: 'sqlite',
        logging: false,
        // storage: './seql-acl-testdb7.sqlite3',
    }

    before(function (done) {
        let self = this;
        let seq = new Sequelize(dbConfig);
        
        self.seqMem1 = new Sequelize({ dialect: 'sqlite',logging: false, });        
        self.seqMem2 = new Sequelize({ dialect: 'sqlite',logging: false, });        
        self.seqMem3 = new Sequelize({ dialect: 'sqlite',logging: false, });        
        
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
