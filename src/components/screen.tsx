import { StyleSheet, View } from 'react-native';

import { MaxContentWidth, Spacing } from '@/constants/theme';

import { Text } from './text';
import type { ReactNode } from 'react';

/** Space reserved at the bottom of tab screens so content clears the floating tab bar. */
export const TAB_BAR_CLEARANCE = 120;

export const GUTTER = Spacing.five - 4;

/** Constrains content width on tablets and the web without affecting phones. */
export function contentWidth(windowWidth: number) {
  return Math.min(windowWidth, MaxContentWidth);
}

type HeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
};

export function ScreenHeader({ eyebrow, title, subtitle, trailing }: HeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        {eyebrow && (
          <Text variant="eyebrow" tone="textTertiary">
            {eyebrow}
          </Text>
        )}
        <Text variant="display">{title}</Text>
        {subtitle && (
          <Text tone="textSecondary" style={styles.subtitle}>
            {subtitle}
          </Text>
        )}
      </View>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.five,
  },
  headerText: {
    flex: 1,
    gap: Spacing.one + 2,
  },
  subtitle: {
    maxWidth: 340,
    marginTop: Spacing.one,
  },
});
