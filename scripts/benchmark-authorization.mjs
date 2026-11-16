import assert from 'node:assert/strict';
import { DataTypes, Sequelize } from 'sequelize';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { cpus, totalmem } from 'node:os';
import Guard from '../build/packages/sequelize-guard/dist/esm/index.esm.js';

const accessChecks = 200;
const bulkRuns = 20;
const usersPerBatch = 32;
const rolesPerUser = 8;
const roleCount = 24;
const resourcesPerRole = 64;
const hierarchyDepth = 64;
const actions = ['read', 'comment', 'edit', 'publish', 'archive', 'restore'];

assert.equal(typeof globalThis.gc, 'function', 'Run Node with --expose-gc');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: ':memory:',
  logging: false,
});

async function measure(operation, runs, exercise) {
  let queries = 0;
  const times = [];
  const heapUsed = () => process.memoryUsage().heapUsed;
  globalThis.gc();
  const initialHeap = heapUsed();
  let sampledHeapPeak = initialHeap;
  sequelize.addHook('beforeQuery', 'benchmark', () => {
    queries++;
  });
  try {
    for (let index = 0; index < runs; index++) {
      const start = performance.now();
      await exercise(index);
      times.push(performance.now() - start);
      sampledHeapPeak = Math.max(sampledHeapPeak, heapUsed());
    }
  } finally {
    sequelize.removeHook('beforeQuery', 'benchmark');
  }
  globalThis.gc();
  const finalHeap = heapUsed();
  times.sort((left, right) => left - right);
  const percentile = (fraction) => times[Math.ceil(runs * fraction) - 1];
  return {
    operation,
    runs,
    p50Ms: Number(percentile(0.5).toFixed(3)),
    p95Ms: Number(percentile(0.95).toFixed(3)),
    queriesPerRun: queries / runs,
    sampledPeakHeapGrowthKiB: Math.round(
      (sampledHeapPeak - initialHeap) / 1024,
    ),
    retainedHeapChangeKiB: Math.round((finalHeap - initialHeap) / 1024),
  };
}

try {
  const Team = sequelize.define('BenchmarkTeam', {
    teamKey: { type: DataTypes.STRING, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
  });
  const Organization = sequelize.define('BenchmarkOrganization', {
    name: { type: DataTypes.STRING, allowNull: false },
  });
  await Promise.all([Team.sync(), Organization.sync()]);
  const guard = new Guard(sequelize, {
    roleHolders: { team: Team, organization: Organization },
  });
  await guard.ready;
  const roles = Array.from(
    { length: roleCount },
    (_, index) => `team-${index}`,
  );
  const users = await guard
    .models()
    .GuardUser.bulkCreate(
      Array.from({ length: bulkRuns * usersPerBatch }, () => ({})),
    );
  for (const role of roles) {
    const resources = Array.from(
      { length: resourcesPerRole },
      (_, index) => `${role}-asset-${index}`,
    );
    await guard.allow(role, actions, resources);
  }
  const { role: root } = await guard.makeRole('organization');
  await guard.allow(root.name, 'read', '*');
  let ancestor = root;
  for (let index = 1; index < hierarchyDepth; index++) {
    const { role } = await guard.makeRole({
      name: `department-${index}`,
      parent_id: ancestor.id,
    });
    ancestor = role;
  }
  const inheritedUser = await guard.makeUser();
  await guard.assignRole(inheritedUser, ancestor.name);
  const wideUser = await guard.makeUser();
  await guard.assignRoles(wideUser, roles);
  const batch = (index) =>
    users.slice(index * usersPerBatch, (index + 1) * usersPerBatch);

  const results = [
    await measure('bulk mixed assignment', bulkRuns, async (index) => {
      const assignments = batch(index).map((user, offset) => ({
        user,
        roles: Array.from(
          { length: rolesPerUser },
          (_, step) => roles[(offset + step) % roles.length],
        ),
      }));
      assert.equal(
        (await guard.assignUserRoles(assignments)).assigned,
        usersPerBatch * rolesPerUser,
      );
    }),
    await measure('bulk shared assignment', bulkRuns, async (index) => {
      assert.equal(
        (await guard.assignRolesToUsers(batch(index), ['reader'])).assigned,
        usersPerBatch,
      );
    }),
    await measure('bulk shared assignment retry', bulkRuns, async (index) => {
      assert.equal(
        (await guard.assignRolesToUsers(batch(index), ['reader'])).assigned,
        0,
      );
    }),
  ];

  const malformedUser = await guard.makeUser();
  const { permissions: malformed } = await guard.allow(
    'malformed',
    'read',
    'Asset',
  );
  await malformed[0].update({
    action: JSON.stringify([
      ...Array.from({ length: 10_000 }, (_, i) => `action-${i}`),
      '*',
      null,
    ]),
  });
  await guard.assignRole(malformedUser, 'malformed');

  const checks = [
    ['direct exact allow', users[0], 'read team-7-asset-63', true],
    ['direct deny', users[0], 'read missing-asset', false],
    ['wide policy deny', wideUser, 'read missing-asset', false],
    ['inherited wildcard allow', inheritedUser, 'read new-asset', true],
    ['large malformed grant deny', malformedUser, 'read Asset', false],
  ];
  for (const [label, user, request, allowed] of checks) {
    for (let index = 0; index < 30; index++) {
      assert.equal(await guard.userCan(user, request), allowed);
    }
    results.push(
      await measure(label, accessChecks, async () => {
        assert.equal(await guard.userCan(user, request), allowed);
      }),
    );
  }
  console.log(
    JSON.stringify(
      {
        node: process.version,
        dialect: sequelize.getDialect(),
        platform: process.platform,
        architecture: process.arch,
        cpuModel: cpus()[0]?.model,
        logicalCpus: cpus().length,
        systemMemoryGiB: Number((totalmem() / 1024 ** 3).toFixed(2)),
        artifactSha256: createHash('sha256')
          .update(
            readFileSync(
              new URL(
                '../build/packages/sequelize-guard/dist/esm/index.esm.js',
                import.meta.url,
              ),
            ),
          )
          .digest('hex'),
        notes:
          'Sequential in-memory SQLite checks; includes schema binding validation. Heap is sampled between runs, not an allocation or RSS peak. No service latency or concurrent throughput claim.',
        users: users.length + 3,
        registeredHolderModels: 2,
        roleCount,
        resourcesPerRole,
        actionsPerResource: actions.length,
        usersPerBatch,
        rolesPerUser,
        hierarchyDepth,
        results,
      },
      null,
      2,
    ),
  );
} finally {
  await sequelize.close();
}
