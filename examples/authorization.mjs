import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import express from 'express';
import { Sequelize } from 'sequelize';
import { SequelizeGuard } from 'sequelize-guard';

// Inject the application's maintained credential verifier/session store.
// It returns a stable principal only AFTER verification; never decode unsigned
// claims or trust x-user-id/body/query IDs as the acting identity.
export function createHandler({ verifySession, guard, findAccount }) {
  return async (req, res) => {
    const send = (status, message) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ message }));
    };
    try {
      const identity = await verifySession(req.headers.authorization);
      if (!identity) return send(401, 'Authentication required');
      const actor = await findAccount(identity.accountId);
      if (!actor) return send(401, 'Authentication required');
      if (req.method === 'GET' && req.url === '/articles') {
        if (!(await guard.userCan(actor, 'read article')))
          return send(403, 'Forbidden');
        return send(200, 'Protected article');
      }
      // Fixed demonstration operation: no user-controlled policy or target.
      // Real cookie-authenticated writes also need application CSRF protection.
      if (req.method === 'POST' && req.url === '/admin/grant') {
        if (!(await guard.userCan(actor, 'manage policy')))
          return send(403, 'Forbidden');
        await guard.allow('reader', 'read', 'article');
        return send(200, 'Policy updated');
      }
      return send(404, 'Not found');
    } catch {
      // Log diagnostic details privately in the application's error handler.
      return send(503, 'Service unavailable');
    }
  };
}

// Executable integration fixture: opaque sessions issued by a test identity
// provider stand in for the application's verified-session dependency.
const sequelize = new Sequelize('sqlite::memory:', { logging: false });
let server;
let databaseClosed = false;
try {
  const guard = new SequelizeGuard(sequelize);
  await guard.ready;
  const reader = await guard.makeUser();
  const admin = await guard.makeUser();
  await guard.assignRole(reader, 'reader');
  await guard.assignRole(admin, 'administrator');
  await guard.allow('administrator', 'manage', 'policy'); // Trusted bootstrap.
  const sessions = new Map([
    ['Bearer verified-reader-session', { accountId: reader.get('id') }],
    ['Bearer verified-admin-session', { accountId: admin.get('id') }],
  ]);
  const handler = createHandler({
    guard,
    verifySession: async (credential) => {
      if (credential === 'Bearer verifier-down')
        throw new Error('identity service unavailable');
      return sessions.get(credential) ?? null;
    },
    findAccount: (id) =>
      guard.models().GuardUser.findByPk(id, { useMaster: true }),
  });
  const app = express();
  app.use(handler); // Exact adapter shared with the Express guide.
  server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (route, authorization, extra = {}) =>
    fetch(base + route, {
      method: route.startsWith('/admin') ? 'POST' : 'GET',
      headers: { ...(authorization ? { authorization } : {}), ...extra },
    });
  assert.equal((await request('/articles')).status, 401);
  assert.equal(
    (
      await request('/articles', undefined, {
        'x-user-id': String(admin.get('id')),
      })
    ).status,
    401,
  );
  assert.equal((await request('/articles', 'Bearer forged')).status, 401);
  assert.equal(
    (
      await request('/admin/grant', 'Bearer verified-reader-session', {
        'x-user-id': String(admin.get('id')),
      })
    ).status,
    403,
  );
  assert.equal(await reader.can('read article'), false); // Denied admin did not mutate.
  assert.equal(
    (await request('/admin/grant', 'Bearer verifier-down')).status,
    503,
  );
  assert.equal(await reader.can('read article'), false);
  assert.equal(
    (await request('/admin/grant', 'Bearer verified-admin-session')).status,
    200,
  );
  assert.equal(
    (await request('/articles', 'Bearer verified-reader-session')).status,
    200,
  );
  await guard.rmPermsFromRole('reader', 'read', 'article');
  assert.equal(
    (await request('/articles', 'Bearer verified-reader-session')).status,
    403,
  );
  await sequelize.close();
  databaseClosed = true; // Real data-store failure, no fake authorization answer.
  const failure = await request(
    '/admin/grant',
    'Bearer verified-admin-session',
  );
  assert.equal(failure.status, 503);
  assert.deepEqual(await failure.json(), { message: 'Service unavailable' });
} finally {
  if (server)
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  if (!databaseClosed) await sequelize.close();
}
