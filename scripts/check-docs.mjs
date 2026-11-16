#!/usr/bin/env node
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const docs = join(root, 'apps/sequelize-guard-docs/content/docs');
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((item) =>
    item.isDirectory() ? files(join(dir, item.name)) : [join(dir, item.name)],
  );
}
const content = files(docs).filter((file) => file.endsWith('.mdx'));
const routes = new Set(
  content.map(
    (file) =>
      '/docs/' +
      file
        .slice(docs.length + 1)
        .replace(/\.mdx$/, '')
        .replace(/(^|\/)index$/, ''),
  ),
);
routes.add('/docs');
const pages = [
  ...content,
  ...files(join(root, 'docs')).filter((file) => file.endsWith('.md') && !file.includes('/docs/ai/')),
  ...files(join(root, 'apps/sequelize-guard-docs/content/blogs')),
  join(root, 'README.md'),
  join(root, 'SECURITY.md'),
  join(root, 'CHANGELOG.md'),
  join(root, 'examples/README.md'),
  join(
    root,
    'apps/sequelize-guard-docs/src/components/screen/home/HomePageScreen.tsx',
  ),
];
for (const file of pages) {
  const text = readFileSync(file, 'utf8');
  assert.doesNotMatch(
    text,
    /guard\.(?:users|roles|permissions|authorization|cache)\./,
    `invented nested API in ${file}`,
  );
  if (file.includes('/content/docs/api/')) assert.doesNotMatch(text, /\]\((?!https?:)[^)]*\.mdx(?:#|\))/, `API link must use a rendered docs route in ${file}`);
  for (const match of text.matchAll(
    /(?:\]\(|href=")([^\s)"#]+)(?:#[^)"]*)?[)"]/g,
  )) {
    const link = match[1];
    if (link.startsWith('/docs')) {
      assert.ok(
        file.startsWith(join(root, 'apps/sequelize-guard-docs')),
        `site-only route in repository/package document ${file}: ${link}`,
      );
      assert.ok(
        routes.has(link.replace(/\/$/, '')),
        `missing route ${link} in ${file}`,
      );
    } else if (!/^(?:https?:|mailto:|\/|#)/.test(link))
      assert.ok(
        existsSync(resolve(dirname(file), decodeURIComponent(link))),
        `missing file ${link} in ${file}`,
      );
  }
}
const manifest = JSON.parse(
  readFileSync(join(root, 'packages/sequelize-guard/package.json'), 'utf8'),
);
const reference = readFileSync(join(docs, 'api/index.mdx'), 'utf8');
assert.ok(
  reference.includes(manifest.version),
  'API version must match package manifest',
);
assert.doesNotMatch(
  reference,
  /\b0\.0\.0\b/,
  'monorepo version leaked into API reference',
);
for (const file of files(docs).filter((file) =>
  /(?:^|\/)meta\.json$/.test(file),
)) {
  const meta = JSON.parse(readFileSync(file, 'utf8'));
  for (const page of meta.pages || []) {
    if (page.startsWith('---') || page === '...' || page.startsWith('!'))
      continue;
    assert.ok(
      existsSync(join(dirname(file), `${page}.mdx`)) ||
        existsSync(join(dirname(file), page, 'index.mdx')),
      `missing navigation page ${page} in ${file}`,
    );
  }
}
console.log(
  `Checked ${pages.length} documentation sources and ${routes.size} docs routes`,
);
