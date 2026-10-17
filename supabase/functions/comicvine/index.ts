// Proxy for the Comic Vine API. The browser can't call Comic Vine directly
// (no CORS), and the API key must stay off the client, so the app calls this
// function and it adds the key from Vault.
//
// Body: { "action": "search", "query": "saga" } or { "action": "volume", "id": "46568" }
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SEARCH_FIELDS = 'id,name,start_year,publisher,image,count_of_issues,deck';
const VOLUME_FIELDS = `${SEARCH_FIELDS},description,people,concepts`;

let cachedKey: string | null = null;

async function apiKey(): Promise<string> {
  if (cachedKey) return cachedKey;
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data, error } = await admin.rpc('comicvine_api_key');
  if (error || !data) throw new Error('Comic Vine key is not configured');
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

  let body: { action?: string; query?: string; id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  let url: URL;
  if (body.action === 'search' && body.query?.trim()) {
    url = new URL('https://comicvine.gamespot.com/api/search/');
    url.searchParams.set('query', body.query.trim().slice(0, 200));
    url.searchParams.set('resources', 'volume');
    url.searchParams.set('limit', '20');
    url.searchParams.set('field_list', SEARCH_FIELDS);
  } else if (body.action === 'volume' && /^\d+$/.test(body.id ?? '')) {
    url = new URL(`https://comicvine.gamespot.com/api/volume/4050-${body.id}/`);
    url.searchParams.set('field_list', VOLUME_FIELDS);
  } else {
    return json({ error: 'Expected { action: "search", query } or { action: "volume", id }' }, 400);
  }

  try {
    url.searchParams.set('api_key', await apiKey());
    url.searchParams.set('format', 'json');
    // Comic Vine rejects requests without a descriptive User-Agent.
    const res = await fetch(url, { headers: { 'User-Agent': 'ShelfApp/1.0' } });
    if (!res.ok) return json({ error: `Comic Vine responded ${res.status}` }, 502);
    const data = await res.json();
    if (data.status_code !== 1) return json({ error: data.error ?? 'Comic Vine error' }, 502);
    return json({ results: data.results });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Comic Vine request failed' }, 502);
  }
});
