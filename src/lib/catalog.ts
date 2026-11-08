import type { Enums, Tables } from './database.types';
import { genresFromAniList, genresFromSubjects, GENRE_TO_SUBJECT, type Genre } from './genres';
import { callFunction } from './functions';

export type Medium = Enums<'medium'>;
export type Unit = 'page' | 'chapter' | 'issue';
export type Source = 'anilist' | 'openlibrary' | 'comicvine' | 'googlebooks';

/** A title as the app sees it, whether it came from an API or from Supabase. */
export type CatalogItem = {
  key: string;
  source: Source;
  sourceId: string;
  medium: Medium;
  title: string;
  authors: string[];
  coverUrl: string | null;
  synopsis: string | null;
  genres: string[];
  year: number | null;
  totalUnits: number | null;
  unit: Unit;
};

export const makeKey = (source: Source, sourceId: string) => `${source}:${sourceId}`;

export function parseKey(key: string): { source: Source; sourceId: string } {
  const index = key.indexOf(':');
  return { source: key.slice(0, index) as Source, sourceId: key.slice(index + 1) };
}

export function rowToItem(row: Tables<'titles'>): CatalogItem {
  return {
    key: makeKey(row.source as Source, row.source_id),
    source: row.source as Source,
    sourceId: row.source_id,
    medium: row.medium,
    title: row.title,
    authors: row.authors,
    coverUrl: row.cover_url,
    synopsis: row.synopsis,
    genres: row.genres,
    year: row.year,
    totalUnits: row.total_units,
    unit: row.unit as Unit,
  };
}

/* -------------------------------------------------------------------------- */
/*  In-memory cache so a tapped search result opens instantly on its detail   */
/* -------------------------------------------------------------------------- */

const memory = new Map<string, CatalogItem>();

export function remember<T extends CatalogItem>(items: T[]): T[] {
  for (const item of items) {
    const existing = memory.get(item.key);
    memory.set(item.key, existing ? { ...existing, ...stripEmpty(item) } : item);
  }
  return items;
}

export const recall = (key: string) => memory.get(key);

function stripEmpty(item: CatalogItem): Partial<CatalogItem> {
  return Object.fromEntries(
    Object.entries(item).filter(([, v]) => v !== null && !(Array.isArray(v) && v.length === 0)),
  );
}

/* -------------------------------------------------------------------------- */
/*  AniList (manga, manhwa, manhua)                                            */
/* -------------------------------------------------------------------------- */

type AniListMedia = {
  id: number;
  title: { english: string | null; romaji: string | null };
  coverImage: { extraLarge: string | null; large: string | null };
  description: string | null;
  genres: string[];
  chapters: number | null;
  startDate: { year: number | null };
  staff: { nodes: { name: { full: string } }[] };
};

const MEDIA_FIELDS = `
  id
  title { english romaji }
  coverImage { extraLarge large }
  description(asHtml: false)
  genres
  chapters
  startDate { year }
  staff(perPage: 2, sort: RELEVANCE) { nodes { name { full } } }
`;

async function aniList<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`AniList responded ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data as T;
}

function cleanDescription(text: string | null): string | null {
  if (!text) return null;
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function fromAniList(media: AniListMedia): CatalogItem {
  return {
    key: makeKey('anilist', String(media.id)),
    source: 'anilist',
    sourceId: String(media.id),
    medium: 'manga',
    title: media.title.english ?? media.title.romaji ?? 'Untitled',
    authors: media.staff.nodes.map((n) => n.name.full),
    coverUrl: media.coverImage.extraLarge ?? media.coverImage.large,
    synopsis: cleanDescription(media.description),
    genres: genresFromAniList(media.genres),
    year: media.startDate.year,
    totalUnits: media.chapters,
    unit: 'chapter',
  };
}

export async function searchManga(query: string): Promise<CatalogItem[]> {
  const data = await aniList<{ Page: { media: AniListMedia[] } }>(
    `query ($q: String) { Page(perPage: 20) {
      media(search: $q, type: MANGA, sort: SEARCH_MATCH, isAdult: false) { ${MEDIA_FIELDS} }
    } }`,
    { q: query },
  );
  return remember(data.Page.media.map(fromAniList));
}

export async function trendingManga(): Promise<CatalogItem[]> {
  const data = await aniList<{ Page: { media: AniListMedia[] } }>(
    `query { Page(perPage: 15) {
      media(type: MANGA, sort: TRENDING_DESC, isAdult: false) { ${MEDIA_FIELDS} }
    } }`,
    {},
  );
  return remember(data.Page.media.map(fromAniList));
}

export async function mangaByGenres(genres: Genre[]): Promise<CatalogItem[]> {
  if (!genres.length) return [];
  const data = await aniList<{ Page: { media: AniListMedia[] } }>(
    `query ($g: [String]) { Page(perPage: 15) {
      media(type: MANGA, genre_in: $g, sort: SCORE_DESC, isAdult: false, popularity_greater: 8000) { ${MEDIA_FIELDS} }
    } }`,
    { g: genres.slice(0, 2) },
  );
  return remember(data.Page.media.map(fromAniList));
}

/**
 * Popular manga for one demographic tag (Shounen, Seinen, Shoujo, Josei).
 * AniList ANDs multiple tags, so callers query one demographic at a time.
 */
export async function mangaByDemographic(tag: string, genres: Genre[]): Promise<CatalogItem[]> {
  const data = await aniList<{ Page: { media: AniListMedia[] } }>(
    `query ($t: [String], $g: [String]) { Page(perPage: 12) {
      media(type: MANGA, tag_in: $t, genre_in: $g, sort: POPULARITY_DESC, isAdult: false) { ${MEDIA_FIELDS} }
    } }`,
    { t: [tag], g: genres.length ? genres.slice(0, 3) : undefined },
  );
  return remember(data.Page.media.map(fromAniList));
}

export async function mangaRecommendations(id: string): Promise<CatalogItem[]> {
  const data = await aniList<{
    Media: { recommendations: { nodes: { mediaRecommendation: AniListMedia | null }[] } };
  }>(
    `query ($id: Int) { Media(id: $id, type: MANGA) {
      recommendations(perPage: 12, sort: RATING_DESC) { nodes { mediaRecommendation { ${MEDIA_FIELDS} } } }
    } }`,
    { id: Number(id) },
  );
  return remember(
    data.Media.recommendations.nodes
      .map((n) => n.mediaRecommendation)
      .filter((m): m is AniListMedia => m !== null)
      .map(fromAniList),
  );
}

async function mangaById(id: string): Promise<CatalogItem> {
  const data = await aniList<{ Media: AniListMedia }>(
    `query ($id: Int) { Media(id: $id, type: MANGA) { ${MEDIA_FIELDS} } }`,
    { id: Number(id) },
  );
  return fromAniList(data.Media);
}

/* -------------------------------------------------------------------------- */
/*  Open Library (books, plus graphic novels and comics)                       */
/* -------------------------------------------------------------------------- */

type OpenLibraryDoc = {
  key: string;
  title: string;
  author_name?: string[];
  cover_i?: number;
  first_publish_year?: number;
  number_of_pages_median?: number;
  subject?: string[];
  cover_edition_key?: string;
  isbn?: string[];
};

const OL_FIELDS =
  'key,title,author_name,cover_i,cover_edition_key,isbn,first_publish_year,number_of_pages_median,subject';
const COMIC_FILTER = 'subject:("graphic novels" OR comics)';

const olCover = (id: number | undefined) =>
  id ? `https://covers.openlibrary.org/b/id/${id}-L.jpg` : null;

/**
 * Best cover guess for a search result: the work's own cover, else its cover
 * edition's, else the first ISBN's. `default=false` makes a missing image 404
 * so the app can show its typeset fallback instead of a blank placeholder.
 */
function olDocCover(doc: OpenLibraryDoc): string | null {
  if (doc.cover_i) return olCover(doc.cover_i);
  if (doc.cover_edition_key) {
    return `https://covers.openlibrary.org/b/olid/${doc.cover_edition_key}-L.jpg?default=false`;
  }
  const isbn = doc.isbn?.find((i) => i.length === 13) ?? doc.isbn?.[0];
  return isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false` : null;
}

const isComicSubject = (subjects: string[] | undefined) =>
  !!subjects?.some((s) => /comic|graphic novel/i.test(s));

function fromOpenLibrary(doc: OpenLibraryDoc, medium?: Medium): CatalogItem {
  const sourceId = doc.key.replace('/works/', '');
  return {
    key: makeKey('openlibrary', sourceId),
    source: 'openlibrary',
    sourceId,
    medium: medium ?? (isComicSubject(doc.subject) ? 'comic' : 'book'),
    title: doc.title,
    authors: doc.author_name?.slice(0, 3) ?? [],
    coverUrl: olDocCover(doc),
    synopsis: null,
    genres: genresFromSubjects(doc.subject),
    year: doc.first_publish_year ?? null,
    totalUnits: doc.number_of_pages_median ?? null,
    unit: 'page',
  };
}

async function openLibrarySearch(params: Record<string, string>, medium?: Medium) {
  const search = new URLSearchParams({ fields: OL_FIELDS, limit: '20', ...params });
  const res = await fetch(`https://openlibrary.org/search.json?${search}`);
  if (!res.ok) throw new Error(`Open Library responded ${res.status}`);
  const json: { docs: OpenLibraryDoc[] } = await res.json();
  return remember(json.docs.map((doc) => fromOpenLibrary(doc, medium)));
}

const searchOpenLibraryBooks = (query: string) => openLibrarySearch({ q: query });

const searchOpenLibraryComics = (query: string) =>
  openLibrarySearch({ q: `${query} ${COMIC_FILTER}` }, 'comic');

export function booksByGenre(genre: Genre, medium: 'book' | 'comic' = 'book') {
  const subject = `subject:"${GENRE_TO_SUBJECT[genre]}"`;
  const q = medium === 'comic' ? `${COMIC_FILTER} ${subject}` : subject;
  return openLibrarySearch({ q, sort: 'rating', limit: '15' }, medium);
}

export const topGraphicNovels = () =>
  openLibrarySearch({ q: COMIC_FILTER, sort: 'rating', limit: '15' }, 'comic');

export async function trendingBooks(): Promise<CatalogItem[]> {
  const res = await fetch('https://openlibrary.org/trending/weekly.json?limit=15');
  if (!res.ok) throw new Error(`Open Library responded ${res.status}`);
  const json: { works: OpenLibraryDoc[] } = await res.json();
  return remember(json.works.map((doc) => fromOpenLibrary(doc, 'book')));
}

type OpenLibraryWork = {
  title: string;
  description?: string | { value: string };
  subjects?: string[];
  covers?: number[];
  first_publish_date?: string;
  authors?: { author: { key: string } }[];
};

async function bookById(id: string): Promise<CatalogItem> {
  const res = await fetch(`https://openlibrary.org/works/${id}.json`);
  if (!res.ok) throw new Error(`Open Library responded ${res.status}`);
  const work: OpenLibraryWork = await res.json();

  const authors = await Promise.all(
    (work.authors ?? []).slice(0, 3).map(async ({ author }) => {
      const r = await fetch(`https://openlibrary.org${author.key}.json`);
      return r.ok ? ((await r.json()).name as string) : null;
    }),
  );

  const description =
    typeof work.description === 'string' ? work.description : work.description?.value;
  const year = work.first_publish_date?.match(/\d{4}/)?.[0];
  const editions = await openLibraryEditions(id);

  return {
    key: makeKey('openlibrary', id),
    source: 'openlibrary',
    sourceId: id,
    medium: isComicSubject(work.subjects) ? 'comic' : 'book',
    title: work.title,
    authors: authors.filter((a): a is string => !!a),
    coverUrl: olCover(work.covers?.find((c) => c > 0) ?? editions.cover),
    synopsis: description?.replace(/\(\[source\]\[\d+\]\)|\[\d+\]:.*$/gms, '').trim() ?? null,
    genres: genresFromSubjects(work.subjects),
    year: year ? Number(year) : null,
    totalUnits: editions.pages,
    unit: 'page',
  };
}

/**
 * Works carry no page count, and some no cover, so read them off the editions:
 * the median page count, and the first edition cover. A failure just means neither.
 */
async function openLibraryEditions(id: string): Promise<{ pages: number | null; cover: number | undefined }> {
  try {
    const res = await fetch(`https://openlibrary.org/works/${id}/editions.json?limit=50`);
    if (!res.ok) return { pages: null, cover: undefined };
    const json: { entries: { number_of_pages?: number; covers?: number[] }[] } = await res.json();
    const pages = json.entries
      .map((e) => e.number_of_pages)
      .filter((p): p is number => !!p && p > 0)
      .sort((a, b) => a - b);
    const cover = json.entries.flatMap((e) => e.covers ?? []).find((c) => c > 0);
    return { pages: pages.length ? pages[Math.floor(pages.length / 2)] : null, cover };
  } catch {
    return { pages: null, cover: undefined };
  }
}

/* -------------------------------------------------------------------------- */
/*  Google Books (the main book catalog), through the `googlebooks` edge       */
/*  function, which holds the API key                                          */
/* -------------------------------------------------------------------------- */

type GoogleVolume = {
  id: string;
  volumeInfo: {
    title?: string;
    authors?: string[];
    publishedDate?: string;
    description?: string;
    industryIdentifiers?: { type: string; identifier: string }[];
    pageCount?: number;
    categories?: string[];
    imageLinks?: Partial<Record<'smallThumbnail' | 'thumbnail' | 'small' | 'medium' | 'large' | 'extraLarge', string>>;
    ratingsCount?: number;
  };
};

async function googleBooks<T>(body: { action: 'search'; query: string } | { action: 'volume'; id: string }) {
  const data = await callFunction<{ results: T }>('googlebooks', body);
  return data.results;
}

/**
 * Largest image Google offers, over https and without the page-curl overlay.
 * `fife` asks for a sharp ~600px cover; the default thumbnail is only 128px wide.
 */
function gbCover(info: GoogleVolume['volumeInfo']): string | null {
  const links = info.imageLinks;
  const url = links?.extraLarge ?? links?.large ?? links?.medium ?? links?.small ?? links?.thumbnail;
  if (url) return `${url.replace(/^http:/, 'https:').replace(/&edge=curl/, '')}&fife=w600-h900`;
  // No Google art: try Open Library's cover for the same ISBN (404s cleanly when it has none).
  const isbn = info.industryIdentifiers?.find((i) => i.type === 'ISBN_13')?.identifier;
  return isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false` : null;
}

function fromGoogleBooks(volume: GoogleVolume): CatalogItem {
  const info = volume.volumeInfo;
  const year = info.publishedDate?.match(/\d{4}/)?.[0];
  return {
    key: makeKey('googlebooks', volume.id),
    source: 'googlebooks',
    sourceId: volume.id,
    medium: isComicSubject(info.categories) ? 'comic' : 'book',
    title: info.title ?? 'Untitled',
    authors: info.authors?.slice(0, 3) ?? [],
    coverUrl: gbCover(info),
    synopsis: cleanDescription(info.description ?? null),
    genres: genresFromSubjects(info.categories),
    year: year ? Number(year) : null,
    totalUnits: info.pageCount || null,
    unit: 'page',
  };
}

/** Same book, any edition or catalog: normalized title plus first author. */
const bookIdentity = (item: CatalogItem) =>
  `${normalizeName(item.title)}|${normalizeName(item.authors[0] ?? '')}`;

/**
 * Google lists every edition and plenty of "Summary of ..." spin-offs. Rank the
 * closest title first, then ones with covers, then the most rated, and keep one
 * entry per book.
 */
function rankGoogleBooks(volumes: GoogleVolume[], query: string): CatalogItem[] {
  const q = normalizeName(query);
  const tier = (name: string) =>
    name === q ? 0 : name.startsWith(q) || q.startsWith(name) ? 1 : name.includes(q) ? 2 : 3;
  const ranked = volumes
    .filter((v) => v.volumeInfo.title)
    .map((v, index) => ({ item: fromGoogleBooks(v), ratings: v.volumeInfo.ratingsCount ?? 0, index }))
    .map((r) => ({ ...r, tier: tier(normalizeName(r.item.title)), cover: r.item.coverUrl ? 0 : 1 }))
    .sort((a, b) => a.tier - b.tier || a.cover - b.cover || b.ratings - a.ratings || a.index - b.index);

  // One entry per book; borrow a page count from another edition when the kept one has none.
  const kept = new Map<string, CatalogItem>();
  for (const { item } of ranked) {
    const id = bookIdentity(item);
    const first = kept.get(id);
    if (!first) kept.set(id, item);
    else if (!first.totalUnits && item.totalUnits) kept.set(id, { ...first, totalUnits: item.totalUnits });
  }
  return [...kept.values()];
}

async function searchGoogleBooks(query: string): Promise<CatalogItem[]> {
  const volumes = await googleBooks<GoogleVolume[]>({ action: 'search', query });
  return remember(rankGoogleBooks(volumes, query));
}

async function googleBookById(id: string): Promise<CatalogItem> {
  return fromGoogleBooks(await googleBooks<GoogleVolume>({ action: 'volume', id }));
}

/**
 * Google Books first (better covers and page counts), then any Open Library
 * books it missed. Either catalog may fail alone.
 */
async function mergeBookSearches(google: Promise<CatalogItem[]>, openLibrary: Promise<CatalogItem[]>, limit: number) {
  const results = await Promise.allSettled([google, openLibrary]);
  if (results.every((r) => r.status === 'rejected')) throw new Error('No book catalog responded.');
  const [fromGoogle, fromOpenLibrary] = results.map((r) => (r.status === 'fulfilled' ? r.value : []));
  const olByIdentity = new Map(fromOpenLibrary.map((item) => [bookIdentity(item), item]));
  // Some Google editions list no page count or cover; Open Library's copy of the same book may.
  const filled = remember(
    fromGoogle.map((item) => {
      const ol = olByIdentity.get(bookIdentity(item));
      return ol
        ? { ...item, totalUnits: item.totalUnits ?? ol.totalUnits, coverUrl: item.coverUrl ?? ol.coverUrl }
        : item;
    }),
  );
  const seen = new Set(filled.map(bookIdentity));
  const extra = fromOpenLibrary.filter((item) => !seen.has(bookIdentity(item)));
  return [...filled, ...extra].slice(0, limit);
}

export const searchBooks = (query: string) =>
  mergeBookSearches(searchGoogleBooks(query), searchOpenLibraryBooks(query), 25);

export const searchByIsbn = (isbn: string) =>
  mergeBookSearches(searchGoogleBooks(`isbn:${isbn}`), openLibrarySearch({ q: `isbn:${isbn}`, limit: '5' }), 5);

/* -------------------------------------------------------------------------- */
/*  Comic Vine (comic series), through the `comicvine` edge function, which    */
/*  holds the API key and gets around Comic Vine's missing CORS headers        */
/* -------------------------------------------------------------------------- */

type ComicVineVolume = {
  id: number;
  name: string;
  start_year: string | null;
  count_of_issues: number | null;
  deck: string | null;
  description?: string | null;
  publisher: { name: string } | null;
  image: { super_url?: string; medium_url?: string } | null;
  people?: { name: string; count?: string }[];
  concepts?: { name: string }[];
};

async function comicVine<T>(body: { action: 'search'; query: string } | { action: 'volume'; id: string }) {
  const data = await callFunction<{ results: T }>('comicvine', body);
  return data.results;
}

/** Comic Vine serves a stock "no image" picture instead of nothing. */
function cvCover(image: ComicVineVolume['image']): string | null {
  const url = image?.super_url ?? image?.medium_url;
  return url && !/blank|image_not_available/i.test(url) ? url : null;
}

function fromComicVine(volume: ComicVineVolume): CatalogItem {
  const creators = [...(volume.people ?? [])]
    .sort((a, b) => Number(b.count ?? 0) - Number(a.count ?? 0))
    .slice(0, 3)
    .map((p) => p.name);
  const year = Number(volume.start_year);
  return {
    key: makeKey('comicvine', String(volume.id)),
    source: 'comicvine',
    sourceId: String(volume.id),
    medium: 'comic',
    title: volume.name,
    // Search results carry no creators, so the publisher stands in until details load.
    authors: creators.length ? creators : volume.publisher ? [volume.publisher.name] : [],
    coverUrl: cvCover(volume.image),
    synopsis: cleanDescription(volume.description ?? volume.deck),
    genres: genresFromSubjects(volume.concepts?.map((c) => c.name)),
    year: Number.isFinite(year) && year > 0 ? year : null,
    totalUnits: volume.count_of_issues || null,
    unit: 'issue',
  };
}

/** Original-language publishers, so DC's Sandman beats its Spanish and Polish reprints. */
const MAJOR_PUBLISHERS = new Set([
  'DC Comics', 'Marvel', 'Image', 'Dark Horse Comics', 'IDW Publishing', 'Boom! Studios',
  'Vertigo', 'Oni Press', 'Fantagraphics', 'Drawn & Quarterly', 'First Second Books',
  'Dynamite Entertainment', 'Valiant', 'Archie Comics Publications', 'Top Shelf',
]);

const normalizeName = (name: string) =>
  name.toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Comic Vine's relevance puts foreign reprints first. Re-rank: closest name
 * match, then major publishers, then longer runs, keeping its order for ties.
 */
function rankVolumes(volumes: ComicVineVolume[], query: string): ComicVineVolume[] {
  const q = normalizeName(query);
  const tier = (v: ComicVineVolume) => {
    const name = normalizeName(v.name);
    return name === q ? 0 : name.startsWith(q) ? 1 : name.includes(q) ? 2 : 3;
  };
  const weight = (v: ComicVineVolume) =>
    (v.publisher && MAJOR_PUBLISHERS.has(v.publisher.name) ? 1000 : 0) + (v.count_of_issues ?? 0);
  return volumes
    .map((v, index) => ({ v, index, tier: tier(v), weight: weight(v) }))
    .sort((a, b) => a.tier - b.tier || b.weight - a.weight || a.index - b.index)
    .map(({ v }) => v);
}

async function searchComicVine(query: string): Promise<CatalogItem[]> {
  const volumes = await comicVine<ComicVineVolume[]>({ action: 'search', query });
  return remember(rankVolumes(volumes, query).map(fromComicVine));
}

async function comicById(id: string): Promise<CatalogItem> {
  return fromComicVine(await comicVine<ComicVineVolume>({ action: 'volume', id }));
}

/** Comic Vine series first, then Open Library graphic novels; either may fail alone. */
export async function searchComics(query: string): Promise<CatalogItem[]> {
  const results = await Promise.allSettled([searchComicVine(query), searchOpenLibraryComics(query)]);
  if (results.every((r) => r.status === 'rejected')) throw new Error('No comic catalog responded.');
  return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])).slice(0, 30);
}

/** Every catalog at once, interleaved so each format's best match sits near the top. */
export async function searchEverything(query: string): Promise<CatalogItem[]> {
  const results = await Promise.allSettled([searchManga(query), searchBooks(query), searchComics(query)]);
  if (results.every((r) => r.status === 'rejected')) throw new Error('Every catalog failed to respond.');
  const [manga, books, comics] = results.map((r) => (r.status === 'fulfilled' ? r.value : []));

  const seen = new Set<string>();
  const merged: CatalogItem[] = [];
  for (let i = 0; i < 20; i++) {
    for (const item of [manga[i], books[i], comics[i]]) {
      if (item && !seen.has(item.key)) {
        seen.add(item.key);
        merged.push(item);
      }
    }
  }
  return merged;
}

/* -------------------------------------------------------------------------- */

/** Full details for a title, merging anything we already know about it. */
export async function fetchTitle(key: string): Promise<CatalogItem> {
  const { source, sourceId } = parseKey(key);
  const fetched =
    source === 'anilist'
      ? await mangaById(sourceId)
      : source === 'comicvine'
        ? await comicById(sourceId)
        : source === 'googlebooks'
          ? await googleBookById(sourceId)
          : await bookById(sourceId);
  const known = recall(key);
  const merged: CatalogItem = known
    ? {
        ...fetched,
        ...stripEmpty(known),
        synopsis: fetched.synopsis ?? known.synopsis,
        // Detail lookups name the creators; Comic Vine search only had the publisher.
        authors: fetched.authors.length ? fetched.authors : known.authors,
        // A work's own cover beats a guessed edition/ISBN cover from search.
        coverUrl: fetched.coverUrl ?? known.coverUrl,
        // Search results know the medium (e.g. "comic" filter) better than a bare work lookup.
        medium: known.medium,
      }
    : fetched;
  memory.set(key, merged);
  return merged;
}

export const MEDIUM_LABEL: Record<Medium, string> = {
  book: 'Book',
  manga: 'Manga',
  comic: 'Comic',
};

export const UNIT_LABEL: Record<Unit, { one: string; many: string; short: string }> = {
  page: { one: 'page', many: 'pages', short: 'p' },
  chapter: { one: 'chapter', many: 'chapters', short: 'ch' },
  issue: { one: 'issue', many: 'issues', short: '#' },
};
