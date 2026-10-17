import {
  booksByGenre,
  mangaByDemographic,
  mangaByGenres,
  mangaRecommendations,
  topGraphicNovels,
  trendingBooks,
  trendingManga,
  type CatalogItem,
  type Medium,
} from './catalog';
import { CANONICAL_GENRES, type Genre } from './genres';
import type { LibraryEntry } from './library';
import type { Profile, Reader } from './profile';

export type RecommendationRow = {
  id: string;
  eyebrow: string;
  heading: string;
  seed?: CatalogItem;
  items: CatalogItem[];
};

const ROW_SIZE = 12;
const MIN_ROW_SIZE = 3;
const ALL_FORMATS: Medium[] = ['manga', 'comic', 'book'];

const DEMOGRAPHICS: Record<Reader, { tags: [string, string]; heading: string }> = {
  men: { tags: ['Shounen', 'Seinen'], heading: 'Shounen and seinen worth starting' },
  women: { tags: ['Shoujo', 'Josei'], heading: 'Shoujo and josei worth starting' },
};

const asGenres = (genres: string[]) =>
  genres.filter((g): g is Genre => (CANONICAL_GENRES as readonly string[]).includes(g));

const none = () => Promise.resolve<CatalogItem[]>([]);

/** Alternates between lists so a row mixes formats instead of clumping them. */
function interleave<T>(...lists: T[][]): T[] {
  const out: T[] = [];
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest; i++) {
    for (const list of lists) if (list[i]) out.push(list[i]);
  }
  return out;
}

async function settle(promises: Promise<CatalogItem[]>[]): Promise<CatalogItem[][]> {
  const results = await Promise.allSettled(promises);
  return results.map((r) => (r.status === 'fulfilled' ? r.value : []));
}

/** Library titles worth recommending from: highly rated, or unrated but kept. */
function pickSeeds(entries: LibraryEntry[]): LibraryEntry[] {
  return entries
    .filter((e) => e.status !== 'dropped' && (e.rating === null || e.rating >= 7))
    .sort((a, b) => (b.rating ?? 6.5) - (a.rating ?? 6.5))
    .slice(0, 3);
}

/** Genres weighted by how much you liked the titles carrying them. */
function topGenres(entries: LibraryEntry[]): Genre[] {
  const scores = new Map<Genre, number>();
  for (const entry of entries) {
    if (entry.status === 'dropped') continue;
    const weight = entry.rating ? entry.rating / 5 : 1;
    for (const genre of asGenres(entry.item.genres)) {
      scores.set(genre, (scores.get(genre) ?? 0) + weight);
    }
  }
  return [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([g]) => g);
}

/** One query per allowed format for a genre, mixed together. */
async function genreAcrossFormats(genre: Genre, formats: Set<Medium>): Promise<CatalogItem[]> {
  const [manga, books, comics] = await settle([
    formats.has('manga') ? mangaByGenres([genre]) : none(),
    formats.has('book') ? booksByGenre(genre) : none(),
    formats.has('comic') ? booksByGenre(genre, 'comic') : none(),
  ]);
  return interleave(manga, books, comics);
}

async function rowForSeed(seed: CatalogItem, formats: Set<Medium>): Promise<CatalogItem[]> {
  const genres = asGenres(seed.genres);
  const lead = genres[0];

  const [similar, manga, books, comics] = await settle([
    seed.medium === 'manga' && formats.has('manga') ? mangaRecommendations(seed.sourceId) : none(),
    seed.medium !== 'manga' && formats.has('manga') ? mangaByGenres(genres) : none(),
    lead && formats.has('book') ? booksByGenre(lead) : none(),
    formats.has('comic') ? (lead ? booksByGenre(lead, 'comic') : topGraphicNovels()) : none(),
  ]);
  return interleave(similar, manga, books, comics);
}

async function demographicManga(reader: Reader, genres: Genre[]): Promise<CatalogItem[]> {
  const [a, b] = DEMOGRAPHICS[reader].tags;
  let lists = await settle([mangaByDemographic(a, genres), mangaByDemographic(b, genres)]);
  // Narrow genre picks can empty the demographic; fall back to the demographic alone.
  if (lists.flat().length < MIN_ROW_SIZE && genres.length) {
    lists = await settle([mangaByDemographic(a, []), mangaByDemographic(b, [])]);
  }
  return interleave(...lists);
}

/**
 * Titles similar to one specific title, for its detail screen. Uses the same
 * cross-format logic as the Discover seed rows and respects your format picks.
 */
export async function similarTitles(
  item: CatalogItem,
  entries: LibraryEntry[],
  profile: Profile | null,
): Promise<CatalogItem[]> {
  const formats = new Set<Medium>(profile?.formats.length ? profile.formats : ALL_FORMATS);
  const owned = new Set(entries.map((e) => e.item.key));
  const seen = new Set<string>([item.key]);

  const candidates = await rowForSeed(item, formats);
  return candidates
    .filter((c) => {
      if (seen.has(c.key) || owned.has(c.key) || !formats.has(c.medium) || !c.coverUrl) return false;
      seen.add(c.key);
      return true;
    })
    .slice(0, 15);
}

export async function buildRecommendations(
  entries: LibraryEntry[],
  profile: Profile | null,
): Promise<RecommendationRow[]> {
  const formats = new Set<Medium>(profile?.formats.length ? profile.formats : ALL_FORMATS);
  const pickedGenres = profile?.genres ?? [];
  const owned = new Set(entries.map((e) => e.item.key));
  const shown = new Set<string>();
  const take = (items: CatalogItem[]) => {
    const fresh = items.filter(
      (i) => formats.has(i.medium) && !owned.has(i.key) && !shown.has(i.key) && i.coverUrl,
    );
    const picked = fresh.slice(0, ROW_SIZE);
    picked.forEach((i) => shown.add(i.key));
    return picked;
  };

  const rows: RecommendationRow[] = [];
  const push = (row: Omit<RecommendationRow, 'items'>, items: CatalogItem[]) => {
    const picked = take(items);
    if (picked.length >= MIN_ROW_SIZE) rows.push({ ...row, items: picked });
  };

  // 1. Titles you rated highly.
  const seeds = pickSeeds(entries);
  const seedResults = await Promise.all(seeds.map((s) => rowForSeed(s.item, formats)));
  seeds.forEach((seed, index) =>
    push(
      {
        id: `seed-${seed.item.key}`,
        eyebrow: seed.rating ? `You rated it ${seed.rating}/10` : 'From your shelf',
        heading: `Because you liked ${seed.item.title}`,
        seed: seed.item,
      },
      seedResults[index],
    ),
  );

  // 2. The genre your shelf leans toward.
  const [shelfGenre] = topGenres(entries);
  if (shelfGenre) {
    push(
      { id: `shelf-genre-${shelfGenre}`, eyebrow: 'Your most-read genre', heading: `More ${shelfGenre}` },
      await genreAcrossFormats(shelfGenre, formats),
    );
  }

  // 3. Answers from onboarding: the genres you picked and, for manga, the demographic.
  const answerGenres = pickedGenres.filter((g) => g !== shelfGenre).slice(0, 3);
  const [demographic, ...genreResults] = await Promise.all([
    profile?.reader && formats.has('manga') ? demographicManga(profile.reader, pickedGenres) : none(),
    ...answerGenres.map((g) => genreAcrossFormats(g, formats)),
  ]);

  answerGenres.forEach((genre, index) =>
    push({ id: `picked-${genre}`, eyebrow: 'Because you picked it', heading: `${genre} picks` }, genreResults[index]),
  );

  if (profile?.reader && formats.has('manga')) {
    push(
      { id: `demographic-${profile.reader}`, eyebrow: 'Manga for you', heading: DEMOGRAPHICS[profile.reader].heading },
      demographic,
    );
  }

  // 4. Fill with what is popular so the screen is never thin.
  if (rows.length < 3) {
    const [manga, books, comics] = await settle([
      formats.has('manga') ? trendingManga() : none(),
      formats.has('book') ? trendingBooks() : none(),
      formats.has('comic') ? topGraphicNovels() : none(),
    ]);
    push({ id: 'trending-manga', eyebrow: 'Out there now', heading: 'Trending manga' }, manga);
    push({ id: 'trending-books', eyebrow: 'Out there now', heading: 'Popular books this week' }, books);
    push({ id: 'graphic-novels', eyebrow: 'Out there now', heading: 'Graphic novels worth owning' }, comics);
  }

  return rows;
}
