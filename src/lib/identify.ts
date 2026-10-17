import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import {
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
  publisher: string | null;
  isbn: string | null;
  search_query: string | null;
  confidence: 'high' | 'medium' | 'low';
  note: string | null;
};

export type Photo = { uri: string; width: number; height: number };

/** Plenty of detail for reading a cover; anything bigger only costs upload time. */
const MAX_EDGE = 1568;

/** Shrinks a camera or library photo and returns it as base64 JPEG. */
export async function encodePhoto(photo: Photo): Promise<string> {
  const context = ImageManipulator.manipulate(photo.uri);
  const longest = Math.max(photo.width, photo.height);
  if (longest > MAX_EDGE) {
    context.resize(photo.width >= photo.height ? { width: MAX_EDGE, height: null } : { width: null, height: MAX_EDGE });
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
  const ranked = titled
    .map((item, index) => ({ item, index, score: closeness(item) }))
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map(({ item }) => item);

  const seen = new Set<string>();
  return [...(byIsbn.status === 'fulfilled' ? byIsbn.value : []), ...ranked]
    .filter((item) => !seen.has(item.key) && seen.add(item.key))
    .slice(0, 6);
}
