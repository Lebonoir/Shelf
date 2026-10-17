import type { Medium } from '@/lib/catalog';

/** One recognisable cover per format, used as art on sign-in and onboarding. */
export const SAMPLE_COVERS: Record<Medium, string> = {
  book: 'https://covers.openlibrary.org/b/id/11481354-M.jpg',
  manga: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/medium/bx30002-Cul4OeN7bYtn.jpg',
  comic: 'https://covers.openlibrary.org/b/id/7774899-M.jpg',
};
