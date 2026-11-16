import { source } from '@/lib/source';
import { getDiscoveryText } from '@/lib/ai-discovery.mjs';

export const revalidate = false;

export function GET() {
  return new Response(getDiscoveryText({ pages: source.getPages() }), {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
