import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSearchAPI } from 'fumadocs-core/search/server';
import { buildSearchIndex } from './search-index.mjs';

test('versioned pages and numbered sections retain distinct search results', async () => {
  const tree = {
    name: 'Documentation',
    children: [{
      type: 'folder',
      name: 'Migration',
      children: [
        { type: 'page', name: 'Foo', url: '/docs/migration/foo' },
        { type: 'page', name: 'Foo 1', url: '/docs/migration/foo-1' },
      ],
    }],
  };
  const pages = [
    {
      path: 'migration/foo.mdx',
      url: '/docs/migration/foo',
      data: {
        title: 'LegacyMarker migration',
        description: 'LegacyMarker overview',
        structuredData: {
          headings: [{ id: 'legacy-heading', content: 'HeadingMarker requirements' }],
          contents: [],
        },
      },
    },
    {
      path: 'migration/foo-1.mdx',
      url: '/docs/migration/foo-1',
      data: {
        title: 'VersionMarker migration',
        description: 'VersionMarker overview',
        structuredData: { headings: [], contents: [] },
      },
    },
  ];
  const indexes = await Promise.all(pages.map((page) => buildSearchIndex(page, tree)));
  assert.deepEqual(indexes.map(({ title, description, breadcrumbs, url }) => ({
    title, description, breadcrumbs, url,
  })), [
    { title: 'LegacyMarker migration', description: 'LegacyMarker overview', breadcrumbs: ['Documentation', 'Migration'], url: '/docs/migration/foo' },
    { title: 'VersionMarker migration', description: 'VersionMarker overview', breadcrumbs: ['Documentation', 'Migration'], url: '/docs/migration/foo-1' },
  ]);

  const api = createSearchAPI('advanced', { language: 'english', indexes });
  for (const [query, expectedUrl] of [
    ['LegacyMarker', '/docs/migration/foo'],
    ['VersionMarker', '/docs/migration/foo-1'],
    ['HeadingMarker', '/docs/migration/foo#legacy-heading'],
  ]) {
    const response = await api.GET(new Request(`http://localhost/api/search?query=${query}`));
    assert.equal(response.status, 200);
    const results = await response.json();
    assert.ok(results.some((result) => result.url === expectedUrl), `${query}: ${JSON.stringify(results)}`);
  }
});
