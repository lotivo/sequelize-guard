/** Curated discovery routes, resolved against the same source as the full dump. */
export const discoveryPaths = [
  '/docs/ai-integration',
  '/docs/guide/getting-started',
  '/docs/api',
  '/docs/guide/db-migrations',
  '/docs/migration/upgrade-to-v6-1',
  '/docs/guide/caching',
  '/docs/guide/authorization',
];

/**
 * @param {{pages: Array<{url: string, data: {title: string}}>}} input
 */
export function getDiscoveryText({ pages }) {
  const links = discoveryPaths.map((url) => {
    const page = pages.find((candidate) => candidate.url === url);
    if (!page) throw new Error(`Missing AI discovery page: ${url}`);
    return `- [${page.data.title}](${page.url})`;
  });
  return `# Sequelize Guard

> Authorization for Sequelize 6. Inspect the installed package version before adapting examples.

## Documentation

${links.join('\n')}
- [Full documentation text](/llms-full.txt)

The npm package includes skills/sequelize-guard/SKILL.md and executable examples/. Load or copy the skill explicitly using your agent tool's documented mechanism; node_modules discovery is not automatic across tools.
`;
}
