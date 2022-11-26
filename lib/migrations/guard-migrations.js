var lodash = require('lodash');
var defaultOpts = require('../defaultOptions.json');
var { tables, schemas, timestamps } = require('./guard-schema');

module.exports = {
  tables,
  schemas,
  defaultOpts,
  up: function (queryInterface, Sequelize, opts) {
    var options = lodash.assign({}, defaultOpts, opts || {});
    var prefix = options.prefix;
    // var tables = Object.keys(defaults);
    const schema = schemas(options);

    return Promise.all(
      lodash.each(tables, function (table) {
        return queryInterface.createTable(
          prefix + table,
          lodash.assign(
            {},
            schema[table],
            options.timestamps ? timestamps.basic : {},
            options.timestamps && options.paranoid ? timestamps.paranoid : {}
          )
        );
      })
    );
  },

  down: function (queryInterface, Sequelize, opts) {
    var options = lodash.assign({}, defaultOpts, opts || {});
    var prefix = options.prefix;
    // var tables = Object.keys(defaults);

    return Promise.all(
      lodash.each(tables.reverse(), function (table) {
        return queryInterface.dropTable(prefix + table);
      })
    );
  },
};
