/**
 * Shelf design tokens. Warm paper in light mode, ink in dark mode,
 * one vermilion accent borrowed from printed manga covers.
 */

export const Colors = {
  light: {
    background: '#F3EFE7',
    surface: '#EAE4D8',
    surfaceStrong: '#DDD5C5',
    text: '#1B1A1F',
    textSecondary: '#6B6660',
    textTertiary: '#9A938A',
    border: 'rgba(27, 26, 31, 0.10)',
    accent: '#C4462E',
    accentSoft: 'rgba(196, 70, 46, 0.12)',
    onAccent: '#FFF8F2',
    danger: '#B3261E',
    shadow: 'rgba(60, 40, 20, 0.18)',
  },
  dark: {
    background: '#141316',
    surface: '#1E1C20',
    surfaceStrong: '#2A272C',
    text: '#F2EEE7',
    textSecondary: '#A8A29A',
    textTertiary: '#6F6A64',
    border: 'rgba(242, 238, 231, 0.09)',
    accent: '#E0664C',
    accentSoft: 'rgba(224, 102, 76, 0.16)',
    onAccent: '#1B0F0B',
    danger: '#F2B8B5',
    shadow: 'rgba(0, 0, 0, 0.5)',
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
