import { json } from '@/lib/api';
import { searchSuggestions } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const q = new URL(request.url).searchParams.get('q') || '';
  if (q.trim().length < 2) return json({ products: [], categories: [] });
  const results = await searchSuggestions(q.trim(), 6);
  return json(results);
}
