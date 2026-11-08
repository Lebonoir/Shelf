import { Text as RNText, type TextProps, type TextStyle } from 'react-native';

import { Fonts, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const VARIANTS = {
  display: { fontFamily: Fonts.display, fontSize: 34, lineHeight: 38, letterSpacing: -0.8 },
  title: { fontFamily: Fonts.display, fontSize: 22, lineHeight: 27, letterSpacing: -0.4 },
  heading: { fontFamily: Fonts.sansSemiBold, fontSize: 17, lineHeight: 22, letterSpacing: -0.2 },
  body: { fontFamily: Fonts.sans, fontSize: 15, lineHeight: 23 },
  label: { fontFamily: Fonts.sansMedium, fontSize: 14, lineHeight: 18 },
  caption: { fontFamily: Fonts.sans, fontSize: 13, lineHeight: 17 },
  eyebrow: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  mono: { fontFamily: Fonts.mono, fontSize: 13, lineHeight: 17, letterSpacing: -0.2 },
} satisfies Record<string, TextStyle>;

// Big type grows less with Dynamic Type so headings don't swallow the screen (HIG: keep hierarchy at every size).
const MAX_SCALE: Partial<Record<keyof typeof VARIANTS, number>> = { display: 1.5, title: 1.75 };

export type TextVariant = keyof typeof VARIANTS;

type Props = TextProps & {
  variant?: TextVariant;
  tone?: ThemeColor;
};

export function Text({ variant = 'body', tone = 'text', style, ...props }: Props) {
  const theme = useTheme();
  return (
    <RNText
      maxFontSizeMultiplier={MAX_SCALE[variant]}
      style={[VARIANTS[variant], { color: theme[tone] }, style]}
      {...props}
    />
  );
}
