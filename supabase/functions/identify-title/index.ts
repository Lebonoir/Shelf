// Identifies a book, manga or comic from a photo (cover, spine, barcode or a
// page) with Gemini vision. The app then looks the answer up in its catalogs.
//
// Body: { "image": "<base64 jpeg/png/webp>", "mediaType": "image/jpeg" }
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Tried in order. Free-tier traffic is the first to be turned away when a
// model is busy (429/503), so fall back to lighter models instead of failing.
const MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite'];
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';

const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Keeps uploads well under Gemini's 20 MB inline request limit.
const MAX_BASE64_LENGTH = 6_800_000;

const nullableString = { type: ['string', 'null'] };

const RESULT_SCHEMA = {
  type: 'object',
  properties: {
    found: { type: 'boolean' },
    title: nullableString,
    authors: { type: 'array', items: { type: 'string' } },
    medium: { type: 'string', enum: ['book', 'manga', 'comic', 'unknown'] },
    series: nullableString,
    volume: nullableString,
    publisher: nullableString,
    isbn: nullableString,
    search_query: nullableString,
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    note: nullableString,
  },
  required: [
    'found', 'title', 'authors', 'medium', 'series', 'volume',
    'publisher', 'isbn', 'search_query', 'confidence', 'note',
  ],
};

const PROMPT = `You identify books, manga and comics from photos for a reading-tracker app.
The photo may show a front cover, a spine, a back cover with a barcode, a title page, or a shelf.
If several titles are visible, pick the most prominent one and say so in "note".

Fill the fields like this:
- found: false only if no book, manga or comic can be made out at all.
- title: the work's title as published in English when you know it, without volume numbers.
- authors: writer first, then artist if they differ. Empty if unknown.
- medium: "manga" for Japanese, Korean or Chinese comics; "comic" for Western comics and graphic novels; "book" for prose; "unknown" if you cannot tell.
- series / volume: the series name and volume or issue number, when the photo shows one.
- isbn: digits only (ISBN-13 preferred), and only if you can read it in the photo.
- search_query: the best short query to find this work in a catalog search (usually the series or work title, no volume number).
- confidence: "high" when the title is legible, "medium" when partly legible or inferred from the art, "low" when guessing.
- note: one short sentence for the reader if something needs explaining, else null.
Do not invent an ISBN or authors you cannot read or do not know.`;

let cachedKey: string | null = null;

async function apiKey(): Promise<string> {
  if (cachedKey) return cachedKey;
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data, error } = await admin.rpc('gemini_api_key');
  if (error || !data) throw new Error('The Gemini key is not configured yet');
  cachedKey = data as string;
  return cachedKey;
}

type Step = { type?: string; content?: { type?: string; text?: string }[] };

/**
 * The interaction's answer. Over REST it arrives as `steps`: "thought" steps
 * first, then a "model_output" step whose content holds the text.
 */
function outputText(body: { output_text?: unknown; steps?: Step[] }): string | null {
  if (typeof body.output_text === 'string') return body.output_text;
  const text = (body.steps ?? [])
    .filter((step) => step.type === 'model_output')
    .flatMap((step) => step.content ?? [])
    .map((part) => (typeof part.text === 'string' ? part.text : ''))
    .join('');
  return text || null;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);

  let body: { image?: string; mediaType?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const image = body.image?.replace(/^data:[^;]+;base64,/, '');
  const mediaType = body.mediaType ?? 'image/jpeg';
  if (!image) return json({ error: 'Send { image: base64, mediaType }' }, 400);
  if (!MEDIA_TYPES.includes(mediaType)) return json({ error: 'Use a JPEG, PNG or WebP image' }, 400);
  if (image.length > MAX_BASE64_LENGTH) return json({ error: 'That image is too large' }, 413);

  try {
    const key = await apiKey();
    let res: Response | null = null;
    for (const model of MODELS) {
      res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          input: [
            { type: 'text', text: PROMPT },
            { type: 'image', data: image, mime_type: mediaType },
          ],
          response_format: { type: 'text', mime_type: 'application/json', schema: RESULT_SCHEMA },
        }),
      });
      if (res.ok || (res.status !== 429 && res.status !== 503)) break;
      console.error('Gemini busy', model, res.status, (await res.text().catch(() => '')).slice(0, 500));
    }

    if (!res!.ok) {
      const detail = await res!.text().catch(() => '');
      console.error('Gemini error', res!.status, detail.slice(0, 2000));
      if (res!.status === 429 || res!.status === 503) {
        return json({ error: 'Gemini is busy right now. Try again in a minute.' }, 503);
      }
      if (res!.status === 403) return json({ error: 'The Gemini key was rejected' }, 502);
      if (res!.status === 400) return json({ error: 'Gemini could not read that request' }, 502);
      return json({ error: `Gemini responded ${res!.status}` }, 502);
    }

    const text = outputText(await res!.json());
    if (!text) return json({ error: "Couldn't read that photo. Try another angle." }, 422);

    const result = JSON.parse(text);
    if (result.medium === 'unknown') result.medium = null;
    return json({ result });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Identification failed' }, 502);
  }
});
