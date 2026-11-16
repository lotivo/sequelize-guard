import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataTypes, Sequelize } from 'sequelize';
import Guard, { migration } from 'sequelize-guard';

// 6.0.2 relied on bundler interop for its Lodash named imports.
const previousUrl = import.meta.resolve('sequelize-guard-previous');
const legacyInterop = registerHooks({
  resolve(specifier, context, nextResolve) {
    const resolved = nextResolve(specifier, context);
    if (specifier !== 'lodash' || context.parentURL !== previousUrl)
      return resolved;
    const bridge =
      'import lodash from ' +
      JSON.stringify(resolved.url) +
      '; export const { includes, uniq, differenceBy, concat, find, filter, intersectionBy, without, merge, values } = lodash;';
    return {
      url: 'data:text/javascript,' + encodeURIComponent(bridge),
      shortCircuit: true,
    };
  },
});
const previous = await import('sequelize-guard-previous').finally(() =>
  legacyInterop.deregister(),
);

const directory = mkdtempSync(join(tmpdir(), 'guard-upgrade-example-'));
process.once('exit', () => rmSync(directory, { recursive: true, force: true }));

function connect() {
  const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: join(directory, 'application.sqlite'),
    logging: false,
  });
  const Account = sequelize.define(
    'Account',
    {
      accountKey: {
        type: DataTypes.STRING,
        primaryKey: true,
        field: 'account_key',
      },
      displayName: { type: DataTypes.STRING, allowNull: false },
    },
    { tableName: 'accounts' },
  );
  return {
    sequelize,
    Account,
    options: { sync: false, UserModel: Account, userPk: 'accountKey' },
  };
}

{
  const { sequelize, Account, options } = connect();
  const from = { ...options, prefix: 'legacy_' };
  try {
    await Account.sync();
    await previous.migration.up(sequelize.getQueryInterface(), sequelize, from);
    const guard = new previous.default(sequelize, from);
    await guard.ready;
    const user = await Account.create({
      accountKey: 'account-A',
      displayName: 'Alex',
    });
    await guard.allow('reader', 'read', 'document');
    await user.assignRole('reader');
    assert.equal(await user.can('read document'), true);
  } finally {
    await sequelize.close();
  }
}

{
  const { sequelize, Account, options } = connect();
  const query = sequelize.getQueryInterface();
  const from = { ...options, prefix: 'legacy_' };
  const to = { ...options, prefix: 'current_' };
  try {
    const legacyMemberships = await query.select(null, 'legacy_role_user');
    assert.equal(legacyMemberships.length, 1);
    await migration.upgrade(query, sequelize, { from, to });
    const guard = new Guard(sequelize, to);
    await guard.ready;
    const user = await Account.findByPk('account-A', { rejectOnEmpty: true });
    assert.equal(user.displayName, 'Alex');
    assert.equal(await user.can('read document'), true);
    assert.deepEqual(await guard.assignRolesToUsers([user], ['editor']), {
      assigned: 1,
    });
    await guard.allow('editor', 'edit', 'document');
    assert.equal(await user.can('edit document'), true);
    await user.rmAssignedRoles(['reader']);
    assert.equal(await user.can('read document'), false);
    assert.deepEqual(
      await query.select(null, 'legacy_role_user'),
      legacyMemberships,
    );
    await migration.down(query, sequelize, to);
    assert.equal(await Account.count(), 1); // Application data survives rollback.
    assert.deepEqual(
      await query.select(null, 'legacy_role_user'),
      legacyMemberships,
    );
  } finally {
    await sequelize.close();
  }
}
