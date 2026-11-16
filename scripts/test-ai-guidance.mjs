import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { setTimeout } from 'node:timers/promises';
import { discoveryPaths, getDiscoveryText } from '../apps/sequelize-guard-docs/src/lib/ai-discovery.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (name) => readFileSync(path.join(root, name), 'utf8');
const manifest = JSON.parse(read('packages/sequelize-guard/package.json'));
const skillPath = 'skills/sequelize-guard/SKILL.md';
const skill = read(skillPath);
const docsRoot = 'apps/sequelize-guard-docs';

test('portable skill metadata, local references and canonical recipe paths match the package', () => {
  assert.match(skill, /^---\nname: sequelize-guard\ndescription: Use when [^\n]+\ncompatibility: [^\n]+\nmetadata:\n  package: sequelize-guard\n  package-version: "([^"]+)"\n---/);
  assert.equal(skill.match(/package-version: "([^"]+)"/)[1], manifest.version);
  assert.equal(JSON.parse(read(`${docsRoot}/package.json`)).version, manifest.version);
  assert.ok(manifest.files.includes(skillPath));
  for (const [, relative] of skill.matchAll(/\]\(([^)]+)\)/g)) {
    assert.ok(!relative.startsWith('/') && !relative.includes('..'), `Nonportable skill reference ${relative}`);
    const file = path.posix.join(path.posix.dirname(skillPath), relative);
    assert.ok(manifest.files.includes(file), `Reference is not shipped: ${file}`);
    assert.ok(read(file).length > 0);
  }
  for (const [, recipe] of skill.matchAll(/`(examples\/[^`]+\.(?:mjs|cjs|ts))`/g)) {
    assert.ok(manifest.files.includes(recipe), `Recipe is not shipped: ${recipe}`);
    assert.ok(read(recipe).length > 0);
  }
  const config = read('packages/sequelize-guard/vite.config.mts');
  for (const file of manifest.files.filter((file) => file.startsWith('skills/') || file.startsWith('examples/'))) {
    assert.ok(config.includes(`'${file}'`), `Missing explicit staging entry: ${file}`);
  }
});

test('copied version detector resolves the consuming app without a package.json export', () => {
  const scratch = mkdtempSync(path.join(tmpdir(), 'guard-skill-portable-'));
  try {
    const app = path.join(scratch, 'application');
    const installed = path.join(app, 'node_modules/sequelize-guard');
    mkdirSync(path.join(installed, 'dist/cjs'), { recursive: true });
    writeFileSync(path.join(installed, 'package.json'), JSON.stringify({
      name: 'sequelize-guard', version: manifest.version, exports: { '.': './dist/cjs/index.cjs' },
      peerDependencies: manifest.peerDependencies,
    }));
    writeFileSync(path.join(installed, 'dist/cjs/index.cjs'), 'module.exports = {};\n');
    const detached = path.join(scratch, 'detached-detector.mjs');
    cpSync(path.join(root, 'skills/sequelize-guard/references/installed-package.mjs'), detached);
    const result = JSON.parse(execFileSync(process.execPath, [detached], { cwd: app, encoding: 'utf8' }));
    assert.deepEqual(result, {
      name: manifest.name, version: manifest.version, sequelize: manifest.peerDependencies.sequelize,
      root: installed, examples: path.join(installed, 'examples'), skill: path.join(installed, skillPath),
    });
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test('discovery resolves real docs routes and includes version and full-text endpoint', () => {
  const pages = discoveryPaths.map((url) => {
    const route = url.slice('/docs/'.length);
    let mdx;
    try { mdx = read(`${docsRoot}/content/docs/${route}.mdx`); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      mdx = read(`${docsRoot}/content/docs/${route}/index.mdx`);
    }
    const title = mdx.match(/^title: (.+)$/m)?.[1];
    assert.ok(title, `Missing title at ${url}`);
    return { url, data: { title } };
  });
  const index = getDiscoveryText({ version: manifest.version, pages });
  assert.match(index, new RegExp(`^# Sequelize Guard ${manifest.version.replaceAll('.', '\\.')}\n`));
  for (const page of pages) assert.ok(index.includes(`](${page.url})`));
  assert.ok(index.includes('](/llms-full.txt)'));
  assert.throws(() => getDiscoveryText({ version: manifest.version, pages: [] }), /Missing AI discovery page/);
  assert.ok(JSON.parse(read(`${docsRoot}/content/docs/meta.json`)).pages.includes('ai-integration'));
  assert.match(read(`${docsRoot}/source.config.ts`), /includeProcessedMarkdown: true/);
  assert.match(read(`${docsRoot}/src/app/llms-full.txt/route.ts`), /source\.getPages\(\)\.map\(getLLMText\)/);
  assert.match(read(`${docsRoot}/src/app/llms.txt/route.ts`), /getDiscoveryText\(\{ version, pages: source\.getPages\(\) \}\)/);
});

test('served discovery and processed full-text routes include AI guidance', { skip: !process.env.DOCS_BASE_URL }, async () => {
  // next start may still be binding its socket when CI launches this check.
  let connected = false;
  let connectionError;
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      await fetch(new URL('/llms.txt', process.env.DOCS_BASE_URL), { signal: AbortSignal.timeout(500) });
      connected = true;
      break;
    } catch (error) {
      connectionError = error;
      await setTimeout(250);
    }
  }
  assert.ok(connected, `Documentation server did not start: ${connectionError}`);
  const api = await fetch(new URL('/docs/api', process.env.DOCS_BASE_URL), { signal: AbortSignal.timeout(5_000) });
  assert.equal(api.status, 200);
  const apiHtml = await api.text();
  assert.ok(apiHtml.includes('href="/docs/api/classes/SequelizeGuard"'));
  assert.ok(!/href="[^"]+\.mdx(?:#|")/.test(apiHtml), 'Rendered API href must use a routable docs path');
  for (const route of ['/llms.txt', '/llms-full.txt']) {
    const response = await fetch(new URL(route, process.env.DOCS_BASE_URL), { signal: AbortSignal.timeout(5_000) });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/plain/);
    const body = await response.text();
    assert.ok(body.startsWith(`# Sequelize Guard ${manifest.version}\n`));
    assert.ok(body.includes('skills/sequelize-guard/SKILL.md'));
    if (route === '/llms-full.txt') {
      assert.ok(body.includes('# AI integration'));
      assert.ok(body.includes('Load the installed skill explicitly'));
      assert.ok(body.includes('Migration') || body.includes('migration'));
    } else {
      for (const url of discoveryPaths) assert.ok(body.includes(`](${url})`));
    }
  }
});
