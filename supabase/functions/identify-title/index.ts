// Identifies a book, manga or comic from a photo (cover, spine, barcode or a
// page) with Claude vision. The app then looks the answer up in its catalogs.
//
// Body: { "image": "<base64 jpeg/png/webp>", "mediaType": "image/jpeg" }
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
type MediaType = (typeof MEDIA_TYPES)[number];

// ~5 MB of image data once decoded, Claude's per-image ceiling.
const MAX_BASE64_LENGTH = 6_800_000;

const nullableString = { type: ['string', 'null'] };

const RESULT_SCHEMA = {
  type: 'object',
  properties: {
    found: { type: 'boolean' },
    title: nullableString,
    authors: { type: 'array', items: { type: 'string' } },
    medium: { type: ['string', 'null'], enum: ['book', 'manga', 'comic', null] },
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
  additionalProperties: false,
};

const SYSTEM = `You identify books, manga and comics from photos for a reading-tracker app.
The photo may show a front cover, a spine, a back cover with a barcode, a title page, or a shelf.
If several titles are visible, pick the most prominent one and say so in "note".

Fill the fields like this:
- found: false only if no book, manga or comic can be made out at all.
- title: the work's title as published in English when you know it, without volume numbers.
- authors: writer first, then artist if they differ. Empty if unknown.
- medium: "manga" for Japanese, Korean or Chinese comics; "comic" for Western comics and graphic novels; "book" for prose.
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
  const { data, error } = await admin.rpc('anthropic_api_key');
  if (error || !data) throw new Error('The Anthropic key is not configured yet');
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

  let body: { image?: string; mediaType?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const image = body.image?.replace(/^data:[^;]+;base64,/, '');
  const mediaType = (body.mediaType ?? 'image/jpeg') as MediaType;
  if (!image) return json({ error: 'Send { image: base64, mediaType }' }, 400);
  if (!MEDIA_TYPES.includes(mediaType)) return json({ error: 'Use a JPEG, PNG or WebP image' }, 400);
  if (image.length > MAX_BASE64_LENGTH) return json({ error: 'That image is too large' }, 413);

  try {
    const client = new Anthropic({ apiKey: await apiKey() });
    const response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: RESULT_SCHEMA },
      },
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
            { type: 'text', text: 'What is this?' },
          ],
        },
      ],
    } as Anthropic.Beta.MessageCreateParamsNonStreaming);

    if (response.stop_reason === 'refusal') {
      return json({ error: "Couldn't read that photo. Try another angle." }, 422);
    }
    const text = response.content.find((b) => b.type === 'text');
    if (!text || text.type !== 'text') return json({ error: 'No answer came back' }, 502);
    return json({ result: JSON.parse(text.text) });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return json({ error: 'Too many scans right now. Try again in a minute.' }, 429);
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return json({ error: 'The Anthropic key was rejected' }, 502);
    }
    if (err instanceof Anthropic.APIError) {
      return json({ error: `Claude responded ${err.status}` }, 502);
    }
    return json({ error: err instanceof Error ? err.message : 'Identification failed' }, 502);
  }
});
