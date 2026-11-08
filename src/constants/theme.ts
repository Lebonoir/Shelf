/**
 * Shelf design tokens: "Old bookshop". Sage paper and library green, with brass
 * for progress. Each format has its own ink so you can tell manga, comics and
 * books apart at a glance. Every text color is at least 4.5:1 on background.
 */

export const Colors = {
  light: {
    background: '#F1F3EE',
    surface: '#E3E8DF',
    surfaceStrong: '#D3DACD',
    text: '#13201A',
    textSecondary: '#46524B',
    textTertiary: '#5E6A62',
    border: 'rgba(19, 32, 26, 0.11)',
    accent: '#1F6B4A',
    accentSoft: 'rgba(31, 107, 74, 0.12)',
    onAccent: '#F6F8F3',
    /** Brass: progress fills only, never text. */
    highlight: '#937012',
    danger: '#B3261E',
    shadow: 'rgba(20, 40, 30, 0.18)',
    manga: '#8A2236',
    comic: '#1D3F7A',
    book: '#6B5408',
  },
  dark: {
    background: '#0E1612',
    surface: '#17211C',
    surfaceStrong: '#22302A',
    text: '#EAF0E8',
    textSecondary: '#A9B5AD',
    textTertiary: '#8C988F',
    border: 'rgba(234, 240, 232, 0.09)',
    accent: '#4FBF8A',
    accentSoft: 'rgba(79, 191, 138, 0.16)',
    onAccent: '#06180F',
    highlight: '#D9B44A',
    danger: '#F2B8B5',
    shadow: 'rgba(0, 0, 0, 0.5)',
    manga: '#F2A7B8',
    comic: '#9DB8EE',
    book: '#D9B44A',
  },
} as const;

export type Palette = { [K in keyof typeof Colors.light]: string };
export type ThemeColor = keyof Palette;

export const Fonts = {
  display: 'Fraunces_600SemiBold',
  displayRegular: 'Fraunces_400Regular',
  sans: 'Geist_400Regular',
  sansMedium: 'Geist_500Medium',
  sansSemiBold: 'Geist_600SemiBold',
  mono: 'GeistMono_500Medium',
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 12,
  four: 16,
  five: 24,
  six: 32,
  seven: 48,
} as const;

export const Radius = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
} as const;

/** Book covers are roughly 2:3. */
export const COVER_RATIO = 1.5;

export const MaxContentWidth = 720;
