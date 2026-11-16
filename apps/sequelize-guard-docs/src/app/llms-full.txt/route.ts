import { getLLMText, source } from '@/lib/source';

export const revalidate = false;

export async function GET() {
  const scanned = await Promise.all(
    source.getPages()
      .filter((page) => page.url !== '/docs/migration/upgrade-to-v6')
      .map(getLLMText),
  );
  return new Response(`# Sequelize Guard\n\n${scanned.join('\n\n')}`, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
