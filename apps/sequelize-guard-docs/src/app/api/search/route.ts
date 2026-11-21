import { source } from '@/lib/source';
import { createFromSource } from 'fumadocs-core/search/server';
import { buildSearchIndex } from '@/lib/search-index.mjs';

export const { GET } = createFromSource(source, {
  // https://docs.orama.com/docs/orama-js/supported-languages
  language: 'english',
  buildIndex: (page) => buildSearchIndex(page, source.getPageTree(page.locale)),
});
