var lodash = require('lodash');
var defaultOpts = require('../defaultOptions');
var {tables, schemas, timestamps} = require('./acl-schema');

module.exports = {
    tables,
    schemas,
    defaultOpts,
    up: function(queryInterface, Sequelize, opts) {
        var options = lodash.assign({}, defaultOpts, opts || {});
        var prefix = options.prefix || '';
        // var tables = Object.keys(defaults);

        return Promise.all(
            lodash.each(tables, function(table) {
                return queryInterface.createTable(
                    prefix + table,
                    lodash.assign({}, schemas[table],
                        options.timestamps ? timestamps.basic : {},
                        options.timestamps && options.paranoid ? timestamps.paranoid : {},
                    )
                );
            })
        );

    },

    down: function(queryInterface, Sequelize, opts) {
        var options = lodash.assign({}, defaultOpts, opts || {});
        var prefix = options.prefix || '';
        // var tables = Object.keys(defaults);

        return Promise.all(
            lodash.each(tables, function(table) {
                return queryInterface.dropTable(prefix + table);
            })
        );
    }
};
