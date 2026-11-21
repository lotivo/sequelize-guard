import { basename, extname } from 'node:path';
import { findPath } from 'fumadocs-core/page-tree';

// Keep the index fields in step with createFromSource's default buildIndex.
export async function buildSearchIndex(page, pageTree) {
  const structuredData =
    'structuredData' in page.data
      ? page.data.structuredData
      : 'load' in page.data && typeof page.data.load === 'function'
        ? (await page.data.load()).structuredData
        : undefined;

  if (!structuredData) {
    throw new Error('Cannot find structured data from page');
  }

  const path = findPath(
    pageTree.children,
    (node) => node.type === 'page' && node.url === page.url,
  );
  let breadcrumbs;
  if (path) {
    breadcrumbs = [pageTree.name, ...path.slice(0, -1).map((node) => node.name)].filter(
      (name) => typeof name === 'string' && name.length > 0,
    );
  }

  return {
    title: page.data.title ?? basename(page.path, extname(page.path)),
    breadcrumbs,
    description: page.data.description,
    url: page.url,
    // Fumadocs appends `-0`, `-1`, ... for descriptions and sections.
    // A page ID ending in "-page" cannot equal one of those child IDs.
    id: `${page.url}-page`,
    structuredData,
  };
}
