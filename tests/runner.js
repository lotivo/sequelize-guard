var Sequelize = require('sequelize');
var SequelizeAcl = require('../lib/index')
    , tests = require('./tests')


describe('Sequelize ACL - SQLite', function () {

    var dbConfig = {
        dialect: 'sqlite',
        logging: false,
        // storage: './seql-acl-testdb5.sqlite3',
    }

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
