import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertUnpublished, releaseMetadata } from './release-metadata.mjs';

test('stable and prerelease tags agree with their public metadata', () => {
  assert.deepEqual(releaseMetadata('v6.1.0', '6.1.0'), {
    version: '6.1.0',
    distTag: 'latest',
    prerelease: false,
  });
  assert.deepEqual(releaseMetadata('v6.1.0-rc.1', '6.1.0'), {
    version: '6.1.0-rc.1',
    distTag: 'next',
    prerelease: true,
  });
});

test('invalid release tags are rejected before they enter workflow outputs', () => {
  for (const tag of [
    '',
    '6.1.0',
    'v06.1.0',
    'v6.1',
    'v6.1.0-',
    'v6.1.0-rc.01',
    'v6.1.0-rc..1',
    'v6.1.0+build',
    'v6.1.0\n',
    'v6.1.0;echo invalid',
  ]) {
    assert.throws(() => releaseMetadata(tag, '6.1.0'), /Invalid release tag/);
  }
  assert.throws(() => releaseMetadata('v7.0.0', '6.1.0'), /manifest version/);
});

test('preflight allows an unpublished version and rejects duplicates and registry errors', async () => {
  await assertUnpublished('6.1.0-rc.1', async (url) => {
    assert.equal(url, 'https://registry.npmjs.org/sequelize-guard/6.1.0-rc.1');
    return new Response(null, { status: 404 });
  });
  await assert.rejects(
    assertUnpublished('6.1.0', async () => new Response(null, { status: 200 })),
    /already published/,
  );
  await assert.rejects(
    assertUnpublished('6.1.0', async () => new Response(null, { status: 503 })),
    /registry returned 503/,
  );
});
