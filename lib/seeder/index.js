'use strict';
var defaultOpts = require('../defaultOptions');

var faker = require('faker');

const roles = ['superadmin', 'admin', 'moderator', 'user'];
const rolesDescriptions = [
  'Has All the permissions',
  'Has bit less permission than superadmin',
  'manages edit delete and has access to less area of system than admin',
  'Basic user or client of system',
];
const actions = {
  VIEW: 'view',
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  ALL: '*',
  APPROVE: 'approve',
};
const resources = ['pages', 'blog', 'acl', 'roles', '*'];

const perms = [
  {
    name: 'SuperAdminPermission',
    description: 'Highest permission, allows everything',
    action: [actions.ALL],
    resource: '*',
  },
  {
    name: 'AdminACL',
    description: 'Allows control of ACL,',
    action: [actions.ALL],
    resource: 'acl',
  },
  {
    name: 'AdminBlogs',
    description: 'Allows full control of blogs',
    action: [actions.ALL],
    resource: 'blog',
  },
  {
    name: 'blog:[view]',
    description: 'View blogs',
    action: [actions.VIEW],
    resource: 'blog',
  },
].map((p) => ({ ...p, action: JSON.stringify(p.action), allow: 1 }));

module.exports = {
  up: async (queryInterface, Sequelize, opts) => {
    var options = Object.assign({}, defaultOpts, opts || {});
    var prefix = options.prefix;

    let roles2insert = roles.map((r, i) => {
      var timestamps = options.timestamps
        ? {
            created_at: Date.now(),
            updated_at: Date.now(),
          }
        : {};

      return Object.assign(
        {},
        {
          name: r,
          description: rolesDescriptions[i],
        },
        timestamps
      );
    });

    return queryInterface
      .bulkInsert(`${prefix}roles`, roles2insert)
      .then(() => {
        return queryInterface.bulkInsert(`${prefix}permissions`, perms);
      });
  },

  down: (queryInterface, Sequelize, opts) => {
    var options = Object.assign({}, defaultOpts, opts || {});
    var prefix = options.prefix;

    return queryInterface
      .bulkDelete(
        `${prefix}roles`,
        roles.map((r) => ({ name: r }))
      )
      .then(() => {
        return queryInterface.bulkDelete(`${prefix}permissions`, perms);
      });
  },
};
