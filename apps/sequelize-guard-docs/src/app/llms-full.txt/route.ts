import { getLLMText, source } from '@/lib/source';
import { version } from '../../../package.json';

export const revalidate = false;

export async function GET() {
  const scanned = await Promise.all(source.getPages().map(getLLMText));
  return new Response(`# Sequelize Guard ${version}\n\n${scanned.join('\n\n')}`, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
