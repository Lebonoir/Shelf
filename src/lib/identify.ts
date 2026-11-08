import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';

import {
  fetchTitle,
  searchBooks,
  searchByIsbn,
  searchComics,
  searchEverything,
  searchManga,
  type CatalogItem,
  type Medium,
} from './catalog';
import { callFunction } from './functions';

/** What Gemini read off the photo (see supabase/functions/identify-title). */
export type Identification = {
  found: boolean;
  title: string | null;
  authors: string[];
  medium: Medium | null;
  series: string | null;
  volume: string | null;
  /** The year this run began, which tells relaunches apart: The Flash (1987) vs (2016). */
  series_start_year: number | null;
  publisher: string | null;
  isbn: string | null;
  search_query: string | null;
  confidence: 'high' | 'medium' | 'low';
  note: string | null;
};

export type Photo = { uri: string; width: number; height: number };

/** Plenty of detail for reading a cover; anything bigger only costs upload time. */
const MAX_EDGE = 1568;

/**
 * Web: let the browser's canvas do the scaling. expo-image-manipulator's web
 * resize is a pure-JS filter that takes 15-20 s on a phone-camera-sized photo.
 */
async function encodeOnWeb(photo: Photo): Promise<string> {
  const blob = await (await fetch(photo.uri)).blob();
  // Applies the photo's EXIF orientation, so phone shots aren't sideways.
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not read that image');
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.82).split(',')[1];
}

/** Shrinks a camera or library photo and returns it as base64 JPEG. */
export async function encodePhoto(photo: Photo): Promise<string> {
  if (Platform.OS === 'web') return encodeOnWeb(photo);

  const context = ImageManipulator.manipulate(photo.uri);
  const longest = Math.max(photo.width, photo.height);
  if (longest > MAX_EDGE) {
    // Pass only the capped side. The web build treats `null` as 0px instead of
    // "keep the ratio" and fails in canvas createImageData.
    context.resize(photo.width >= photo.height ? { width: MAX_EDGE } : { height: MAX_EDGE });
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.82, base64: true });
  context.release();
  image.release();
  if (!saved.base64) throw new Error('Could not read that image');
  return saved.base64;
}

export async function identifyPhoto(base64: string): Promise<Identification> {
  const data = await callFunction<{ result: Identification }>('identify-title', {
    image: base64,
    mediaType: 'image/jpeg',
  });
  return data.result;
}

const normalize = (text: string) =>
  text.toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim();

const issueNumber = (volume: string | null) => {
  const n = Number.parseInt(volume?.match(/\d+/)?.[0] ?? '', 10);
  return Number.isFinite(n) ? n : null;
};

const surname = (name: string) => normalize(name).split(' ').pop() ?? '';

/** How many of the creators read off the cover this catalog entry credits. */
const creatorHits = (item: CatalogItem, creators: string[]) => {
  const credited = new Set(item.authors.map(surname));
  return creators.filter((name) => credited.has(surname(name))).length;
};

/**
 * Comic series get relaunched under the same name (The Flash 1959, 1987,
 * 2016...), so a title match alone picks the wrong run. Use what the cover
 * says: the run must reach the issue number, should start near the year the
 * model gave, and should credit the creators printed on the cover.
 */
async function pickComicRun(
  candidates: CatalogItem[],
  id: Identification,
  closeness: (item: CatalogItem) => number,
): Promise<CatalogItem[]> {
  const issue = issueNumber(id.volume);
  const scored = candidates.map((item, index) => ({
    item,
    index,
    tier: closeness(item),
    fits: !issue || item.unit !== 'issue' || !item.totalUnits || item.totalUnits >= issue,
    gap: id.series_start_year && item.year ? Math.abs(item.year - id.series_start_year) : 99,
    hits: 0,
  }));
  type Scored = (typeof scored)[number];
  const order = (a: Scored, b: Scored) =>
    b.hits - a.hits || a.tier - b.tier || Number(b.fits) - Number(a.fits) || a.gap - b.gap || a.index - b.index;
  scored.sort(order);

  // Credits need a detail lookup per series, so only check the likeliest few.
  if (id.authors.length) {
    const likely = scored.filter((s) => s.item.source === 'comicvine' && s.tier <= 1 && s.fits).slice(0, 4);
    await Promise.all(
      likely.map(async (s) => {
        try {
          s.item = await fetchTitle(s.item.key);
          s.hits = creatorHits(s.item, id.authors);
        } catch {
          // A failed lookup just leaves this candidate unconfirmed.
        }
      }),
    );
    scored.sort(order);
  }
  return scored.map((s) => s.item);
}

function searchFor(medium: Medium | null, query: string, author: string | undefined) {
  if (medium === 'manga') return searchManga(query);
  if (medium === 'comic') return searchComics(query);
  if (medium === 'book') return searchBooks(author ? `${query} ${author}` : query);
  return searchEverything(query);
}

/**
 * Catalog entries for what was identified: ISBN hits first, then the closest
 * title matches from the catalog for its format.
 */
export async function findMatches(id: Identification): Promise<CatalogItem[]> {
  // Catalog searches match titles, and the model sometimes folds the author into
  // search_query ("Berserk Kentaro Miura"), so prefer the series or title it read.
  const query =
    id.medium === 'manga' || id.medium === 'comic'
      ? (id.series ?? id.title ?? id.search_query)
      : (id.title ?? id.search_query);
  if (!id.found || !query) return [];

  const [byIsbn, byTitle] = await Promise.allSettled([
    id.isbn ? searchByIsbn(id.isbn) : Promise.resolve([]),
    searchFor(id.medium, query, id.authors[0]),
  ]);
  let titled = byTitle.status === 'fulfilled' ? byTitle.value : [];
  // An author in an Open Library query can over-narrow it; retry with the title alone.
  if (!titled.length && id.medium === 'book' && id.authors[0]) titled = await searchBooks(query);

  const target = normalize(id.title ?? query);
  const closeness = (item: CatalogItem) => {
    const title = normalize(item.title);
    return title === target ? 0 : title.startsWith(target) || target.startsWith(title) ? 1 : title.includes(target) ? 2 : 3;
  };
  const ranked =
    id.medium === 'comic'
      ? await pickComicRun(titled, id, closeness)
      : titled
          .map((item, index) => ({ item, index, score: closeness(item) }))
          .sort((a, b) => a.score - b.score || a.index - b.index)
          .map(({ item }) => item);

  const seen = new Set<string>();
  return [...(byIsbn.status === 'fulfilled' ? byIsbn.value : []), ...ranked]
    .filter((item) => !seen.has(item.key) && seen.add(item.key))
    .slice(0, 6);
}
