import { Sequelize, DataTypes } from 'sequelize';
import { SequelizeGuard } from 'sequelize-guard';
import { guardOptions } from './migrations.mjs';

export function defineAccount(sequelize) {
  return sequelize.define('Account', {
    email: { type: DataTypes.STRING, allowNull: false },
  }, { tableName: 'application_accounts' });
}

// Existing application startup: the deployment runner has already migrated.
// One Guard per connection lifetime. No table provisioning at worker startup.
export async function createApplication({ sequelize, Account, reader, admin }) {
  const guard = new SequelizeGuard(sequelize, guardOptions(Account));
  await guard.ready;
  const sessions = new Map([['reader-session', reader.id], ['admin-session', admin.id]]);
  async function authenticate(request) {
    const id = sessions.get(request.session);
    return id === undefined ? null : Account.findByPk(id);
  }
  async function readDocument(request) {
    try {
      const actor = await authenticate(request);
      if (!actor) return { status: 401 };
      if (!await guard.userCan(actor, 'read document')) return { status: 403 };
      return { status: 200, body: 'document' };
    } catch {
      return { status: 503 };
    }
  }
  // Fixed grant to the existing reader; request body IDs/roles are never trusted.
  async function grantReader(request) {
    try {
      const actor = await authenticate(request);
      if (!actor) return { status: 401 };
      if (!await guard.userCan(actor, 'manage policy')) return { status: 403 };
      await guard.allow('reader', 'read', 'document');
      await guard.assignRole(reader, 'reader');
      return { status: 200 };
    } catch {
      return { status: 503 };
    }
  }
  return { sequelize, Account, reader, admin, guard, authenticate, readDocument, grantReader };
}

// Trusted provisioning operation; never exposed as an authenticated endpoint.
export async function bootstrapAdmin(guard, admin) {
  await guard.allow('administrator', 'manage', 'policy');
  await guard.assignRole(admin, 'administrator');
}
