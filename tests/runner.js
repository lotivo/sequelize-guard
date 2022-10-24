var Sequelize = require('sequelize');
var SequelizeGuard = require('../lib/index'),
  tests = require('./tests');

var schemas = require('../lib/migrations/guard-schema').schemas;

describe('Sequelize Guard - SQLite', function () {
  var dbConfig = {
    dialect: 'sqlite',
    logging: false,
    // storage: './seql-guard-test-db.sqlite3',
  };

  before(function (done) {
    let self = this;
    let seq = new Sequelize(dbConfig);

    self.seqMem1 = new Sequelize({ dialect: 'sqlite', logging: false });
    self.seqMem2 = new Sequelize({ dialect: 'sqlite', logging: false });
    self.seqMem3 = new Sequelize({ dialect: 'sqlite', logging: false });

    seq
      .authenticate()
      .then(function () {
        return seq.drop().then(function () {
          self.guard = new SequelizeGuard(seq, {});
          done();
        });
      })
      .catch(done);
  });

  run();
});

function run() {
  Object.keys(tests).forEach(function (test) {
    tests[test]();
  });
}
