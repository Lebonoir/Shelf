// Proxy for the Google Books API. Keyless requests are no longer served, and
// the key must stay off the client, so the app calls this function and it adds
// the key from Vault.
//
// Body: { "action": "search", "query": "atomic habits" } or { "action": "volume", "id": "XfFvDwAAQBAJ" }
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const INFO =
  'title,subtitle,authors,publishedDate,description,industryIdentifiers,pageCount,categories,imageLinks,averageRating,ratingsCount';
const SEARCH_FIELDS = `items(id,volumeInfo(${INFO}))`;
const VOLUME_FIELDS = `id,volumeInfo(${INFO})`;

let cachedKey: string | null = null;

async function apiKey(): Promise<string> {
  if (cachedKey) return cachedKey;
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data, error } = await admin.rpc('googlebooks_api_key');
  if (error || !data) throw new Error('Google Books key is not configured');
  cachedKey = data as string;
  return cachedKey;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);

  let body: { action?: string; query?: string; id?: string; limit?: number };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  let url: URL;
  if (body.action === 'search' && body.query?.trim()) {
    url = new URL('https://www.googleapis.com/books/v1/volumes');
    url.searchParams.set('q', body.query.trim().slice(0, 200));
    url.searchParams.set('printType', 'books');
    url.searchParams.set('maxResults', String(Math.min(Math.max(body.limit ?? 30, 1), 40)));
    url.searchParams.set('fields', SEARCH_FIELDS);
  } else if (body.action === 'volume' && /^[\w-]{4,20}$/.test(body.id ?? '')) {
    url = new URL(`https://www.googleapis.com/books/v1/volumes/${body.id}`);
    url.searchParams.set('fields', VOLUME_FIELDS);
  } else {
    return json({ error: 'Expected { action: "search", query } or { action: "volume", id }' }, 400);
  }

  try {
    url.searchParams.set('key', await apiKey());
    const res = await fetch(url);
    if (!res.ok) {
      cachedKey = null; // re-read Vault next time, in case the key was replaced
      const detail = (await res.json().catch(() => null))?.error?.message;
      return json({ error: `Google Books responded ${res.status}${detail ? `: ${detail}` : ''}` }, 502);
    }
    const data = await res.json();
    return json({ results: body.action === 'search' ? (data.items ?? []) : data });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Google Books request failed' }, 502);
  }
});
