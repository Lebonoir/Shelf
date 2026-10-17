import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { COVER_RATIO, Fonts, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Text } from './text';

type Props = {
  uri: string | null;
  title: string;
  width: number;
  radius?: number;
  /** Format shown on the typeset fallback, e.g. "Comic". */
  label?: string;
  /** First author, shown on the typeset fallback. */
  byline?: string;
};

/** Below this width the fallback drops everything but the title. */
const COMPACT_WIDTH = 84;

/**
 * A book cover. When the catalog has no art, or the image fails to load,
 * it renders a typeset cover instead of an empty box.
 */
export function Cover({ uri, title, width, radius = Radius.sm, label, byline }: Props) {
  const theme = useTheme();
  const height = width * COVER_RATIO;
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const showImage = !!uri && failedUri !== uri;
  const compact = width < COMPACT_WIDTH;

  return (
    <View
      style={[
        styles.frame,
        { width, height, borderRadius: radius, backgroundColor: theme.surfaceStrong, shadowColor: theme.shadow },
      ]}>
      {showImage ? (
        <Image
          source={uri}
          style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
          contentFit="cover"
          transition={220}
          recyclingKey={uri}
          onError={() => setFailedUri(uri)}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View
          style={[
            styles.fallback,
            { padding: compact ? 6 : width / 12 },
          ]}
          accessible
          accessibilityLabel={`${title}, no cover art`}>
          {!compact && (
            <View style={[styles.printBorder, { borderColor: theme.border, borderRadius: Math.max(2, radius - 3) }]} />
          )}
          {!compact && label ? (
            <Text variant="eyebrow" tone="accent" style={{ fontSize: Math.min(11, width / 11) }}>
              {label}
            </Text>
          ) : (
            <View />
          )}
          <View style={{ gap: compact ? 0 : width / 30 }}>
            <View style={[styles.rule, { backgroundColor: theme.accent, width: compact ? 10 : width / 5 }]} />
            <Text
              numberOfLines={compact ? 4 : 5}
              tone="text"
              style={{
                fontFamily: Fonts.display,
                fontSize: compact ? 9 : Math.max(12, width / 8.5),
                lineHeight: compact ? 11 : Math.max(15, width / 6.6),
                letterSpacing: -0.2,
              }}>
              {title}
            </Text>
            {!compact && byline ? (
              <Text variant="caption" tone="textSecondary" numberOfLines={1} style={{ fontSize: Math.min(12, width / 10) }}>
                {byline}
              </Text>
            ) : null}
          </View>
        </View>
      )}
      {/* Spine highlight: a thin light edge sells the "physical book" read. */}
      <View style={[styles.spine, { borderTopLeftRadius: radius, borderBottomLeftRadius: radius }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  fallback: {
    flex: 1,
    justifyContent: 'space-between',
  },
  printBorder: {
    position: 'absolute',
    top: 5,
    left: 7,
    right: 5,
    bottom: 5,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  rule: {
    height: 2,
    borderRadius: 1,
    marginBottom: 4,
  },
  spine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
});
