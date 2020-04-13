'use strict';

var faker = require('faker');

module.exports = {
    up: async (queryInterface, Sequelize) => {

            return queryInterface.bulkInsert('acl_roles',[
                {
                    name : "public",
                    label : "Public",
                    description : "Open for all",
                    created_at : Date.now(),
                    updated_at : Date.now()
                }
            ],{});

    },

    down: (queryInterface, Sequelize) => {
        /*
        Add reverting commands here.
        Return a promise to correctly handle asynchronicity.

        Example:
        return queryInterface.bulkDelete('People', null, {});
        */
        return queryInterface.bulkDelete('acl_roles', [{
            name: 'public',
        }])
    }
};
