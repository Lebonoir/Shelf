/**
 * A shared genre vocabulary across books, manga and comics. Every source's
 * tags get mapped onto these labels, which is what lets a manga you loved
 * recommend a novel (and the other way round).
 */
export const CANONICAL_GENRES = [
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Fantasy',
  'Historical',
  'Horror',
  'Mystery',
  'Psychological',
  'Romance',
  'Sci-Fi',
  'Slice of Life',
  'Sports',
  'Supernatural',
  'Thriller',
] as const;

export type Genre = (typeof CANONICAL_GENRES)[number];

/** Keyword fragments found in Open Library subjects, mapped to a canonical genre. */
const SUBJECT_KEYWORDS: [string, Genre][] = [
  ['science fiction', 'Sci-Fi'],
  ['science-fiction', 'Sci-Fi'],
  ['dystopia', 'Sci-Fi'],
  ['space opera', 'Sci-Fi'],
  ['fantasy', 'Fantasy'],
  ['magic', 'Fantasy'],
  ['dragons', 'Fantasy'],
  ['horror', 'Horror'],
  ['ghost', 'Supernatural'],
  ['vampire', 'Supernatural'],
  ['supernatural', 'Supernatural'],
  ['paranormal', 'Supernatural'],
  ['mystery', 'Mystery'],
  ['detective', 'Mystery'],
  ['crime', 'Mystery'],
  ['thriller', 'Thriller'],
  ['suspense', 'Thriller'],
  ['psycholog', 'Psychological'],
  ['romance', 'Romance'],
  ['love stories', 'Romance'],
  ['humor', 'Comedy'],
  ['humorous', 'Comedy'],
  ['comedy', 'Comedy'],
  ['adventure', 'Adventure'],
  ['action', 'Action'],
  ['war', 'Action'],
  ['superhero', 'Action'],
  ['historical', 'Historical'],
  ['history', 'Historical'],
  ['sports', 'Sports'],
  ['family life', 'Slice of Life'],
  ['coming of age', 'Slice of Life'],
  ['domestic fiction', 'Slice of Life'],
  ['drama', 'Drama'],
];

export function genresFromSubjects(subjects: string[] | undefined, max = 5): Genre[] {
  if (!subjects?.length) return [];
  const found = new Set<Genre>();
  for (const raw of subjects) {
    const subject = raw.toLowerCase();
    for (const [keyword, genre] of SUBJECT_KEYWORDS) {
      if (subject.includes(keyword)) found.add(genre);
    }
    if (found.size >= max) break;
  }
  return [...found].slice(0, max);
}

/** AniList genres mostly match ours already; drop the ones we don't track. */
export function genresFromAniList(genres: string[] | undefined): Genre[] {
  if (!genres?.length) return [];
  return genres.filter((g): g is Genre => (CANONICAL_GENRES as readonly string[]).includes(g));
}

/** The Open Library subject to query when looking for books of a canonical genre. */
export const GENRE_TO_SUBJECT: Record<Genre, string> = {
  Action: 'action & adventure',
  Adventure: 'adventure',
  Comedy: 'humorous fiction',
  Drama: 'drama',
  Fantasy: 'fantasy',
  Historical: 'historical fiction',
  Horror: 'horror',
  Mystery: 'mystery',
  Psychological: 'psychological fiction',
  Romance: 'romance',
  'Sci-Fi': 'science fiction',
  'Slice of Life': 'domestic fiction',
  Sports: 'sports',
  Supernatural: 'supernatural',
  Thriller: 'thriller',
};
