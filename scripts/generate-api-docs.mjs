#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  rmSync,
  mkdirSync,
  renameSync,
} from 'node:fs';
import { join, dirname, basename, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(
  readFileSync(join(root, 'packages/sequelize-guard/package.json'), 'utf8'),
);
const revision =
  process.env.DOCS_SOURCE_REVISION ||
  execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
// Never read the monorepo 0.0.0 or infer a later master/latest-tag version.
const output = join(root, 'apps/sequelize-guard-docs/content/docs/api');
const checkedOutRevision = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: root,
  encoding: 'utf8',
}).trim();
const resolvedRevision = execFileSync(
  'git',
  ['rev-parse', '--verify', `${revision}^{commit}`],
  { cwd: root, encoding: 'utf8' },
).trim();
if (resolvedRevision !== checkedOutRevision)
  throw new Error(
    'DOCS_SOURCE_REVISION must identify the checked-out source revision',
  );
const temporary = mkdtempSync(join(root, '.guard-api-'));
try {
  execFileSync(
    process.execPath,
    [
      join(root, 'node_modules/typedoc/bin/typedoc'),
      '--out',
      temporary,
      '--name',
      `sequelize-guard v${manifest.version}`,
      '--includeVersion',
      'false',
      '--gitRevision',
      revision,
    ],
    { cwd: root, stdio: 'inherit' },
  );
  function convert(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        convert(path);
        continue;
      }
      if (!entry.name.endsWith('.md')) continue;
      let content = readFileSync(path, 'utf8');
      content = content.replace(
        /\]\(([^)#]+)\.md(#[^)]*)?\)/g,
        (match, target, anchor = '') => {
          if (/^[a-z]+:/i.test(target)) return match;
          const local = relative(
            temporary,
            resolve(dirname(path), `${target}.md`),
          )
            .split(sep)
            .join('/');
          if (local.startsWith('../'))
            throw new Error(`API link escapes output: ${target}`);
          const route =
            `/docs/api/${local.replace(/\.md$/, '').replace(/(?:^|\/)README$/, '')}`.replace(
              /\/$/,
              '',
            );
          return `](${route}${anchor})`;
        },
      );
      const name = basename(path, '.md');
      const title =
        name === 'README'
          ? 'API Reference'
          : (content.match(/^#\s+(.+)$/m)?.[1] || name).replace(
              /\\([<>])/g,
              '$1',
            );
      const frontmatter = `---\ntitle: ${JSON.stringify(title)}\n---\n\n`;
      const provenance =
        name === 'README'
          ? `Package **${manifest.version}**, source revision [${revision}](https://github.com/lotivo/sequelize-guard/tree/${revision}). Generated from this checkout; local uncommitted changes, if any, are included.\n\n`
          : '';
      writeFileSync(
        join(dirname(path), name === 'README' ? 'index.mdx' : `${name}.mdx`),
        frontmatter + provenance + content,
      );
      rmSync(path);
    }
  }
  convert(temporary);
  // Replace the complete generated tree so removed exports cannot remain stale.
  rmSync(output, { recursive: true, force: true });
  mkdirSync(dirname(output), { recursive: true });
  renameSync(temporary, output);
  console.log(
    `Generated sequelize-guard ${manifest.version} API docs from ${revision}`,
  );
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
