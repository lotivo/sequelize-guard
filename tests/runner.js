var Sequelize = require('sequelize');
var SequelizeAcl = require('../lib/index')
    , tests = require('./tests')


describe('Sequelize ACL', function () {


    run();
})

function run() {
    Object.keys(tests).forEach(function (test) {
        tests[test]()
    })
}
