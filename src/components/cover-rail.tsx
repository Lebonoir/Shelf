import { Image } from 'expo-image';
import { CaretLeft, CaretRight } from 'phosphor-react-native';
import { useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { COVER_RATIO, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { CatalogItem } from '@/lib/catalog';

import { CoverTile } from './cover-tile';
import { PressableScale } from './pressable-scale';
import { GUTTER } from './screen';
import { Skeleton } from './skeleton';
import { Text } from './text';

export const RAIL_TILE = 118;
const TILE_GAP = Spacing.four;
const TILE_STRIDE = RAIL_TILE + TILE_GAP;

function ArrowButton({ direction, disabled, onPress }: { direction: -1 | 1; disabled: boolean; onPress: () => void }) {
  const theme = useTheme();
  const Icon = direction === -1 ? CaretLeft : CaretRight;
  return (
    <PressableScale
      haptic
      scaleTo={0.9}
      disabled={disabled}
      onPress={onPress}
      accessibilityLabel={direction === -1 ? 'Show previous titles' : 'Show more titles'}
      accessibilityState={{ disabled }}
      style={[
        styles.arrow,
        { borderColor: theme.border, backgroundColor: disabled ? 'transparent' : theme.surface },
        disabled && styles.arrowDisabled,
      ]}>
      <Icon size={16} color={theme.text} weight="bold" />
    </PressableScale>
  );
}

type Props = {
  eyebrow: string;
  heading: string;
  items: CatalogItem[];
  /** Small cover beside the heading, for "because you liked X" rows. */
  seedCoverUrl?: string | null;
};

/** A titled horizontal row of covers with previous/next arrows. */
export function CoverRail({ eyebrow, heading, items, seedCoverUrl }: Props) {
  const list = useRef<FlatList<CatalogItem>>(null);
  const [offset, setOffset] = useState(0);
  const [viewport, setViewport] = useState(0);
  const [content, setContent] = useState(0);

  const maxOffset = Math.max(0, content - viewport);
  const scrollable = maxOffset > 4;

  // Page by whole tiles so a press never leaves a cover cut in half at the edge.
  const page = (direction: -1 | 1) => {
    const step = Math.max(1, Math.floor((viewport - GUTTER) / TILE_STRIDE)) * TILE_STRIDE;
    const target = Math.min(maxOffset, Math.max(0, offset + direction * step));
    list.current?.scrollToOffset({ offset: target, animated: true });
  };

  return (
    <View style={styles.rail}>
      <View style={styles.head}>
        {seedCoverUrl && <Image source={seedCoverUrl} style={styles.seedCover} contentFit="cover" />}
        <View style={styles.titles}>
          <Text variant="eyebrow" tone="accent">
            {eyebrow}
          </Text>
          <Text variant="title" numberOfLines={2}>
            {heading}
          </Text>
        </View>
        {scrollable && (
          <View style={styles.arrows}>
            <ArrowButton direction={-1} disabled={offset <= 4} onPress={() => page(-1)} />
            <ArrowButton direction={1} disabled={offset >= maxOffset - 4} onPress={() => page(1)} />
          </View>
        )}
      </View>
      <FlatList
        ref={list}
        horizontal
        data={items}
        keyExtractor={(item) => item.key}
        showsHorizontalScrollIndicator={false}
        style={styles.bleed}
        contentContainerStyle={styles.strip}
        onLayout={(e) => setViewport(e.nativeEvent.layout.width)}
        onContentSizeChange={(width) => setContent(width)}
        onScroll={(e) => setOffset(e.nativeEvent.contentOffset.x)}
        scrollEventThrottle={48}
        renderItem={({ item }) => <CoverTile item={item} width={RAIL_TILE} />}
      />
    </View>
  );
}

export function CoverRailSkeleton() {
  return (
    <View style={styles.rail}>
      <View style={{ gap: Spacing.two }}>
        <Skeleton width={120} height={12} />
        <Skeleton width="70%" height={24} />
      </View>
      <View style={styles.skeletonStrip}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} width={RAIL_TILE} height={RAIL_TILE * COVER_RATIO} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    gap: Spacing.four,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.three,
  },
  seedCover: {
    width: 34,
    height: 51,
    borderRadius: 4,
  },
  titles: {
    flex: 1,
    gap: Spacing.one,
  },
  arrows: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingBottom: 2,
  },
  arrow: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowDisabled: {
    opacity: 0.35,
  },
  bleed: {
    marginHorizontal: -GUTTER,
  },
  strip: {
    gap: TILE_GAP,
    paddingHorizontal: GUTTER,
  },
  skeletonStrip: {
    flexDirection: 'row',
    gap: TILE_GAP,
    overflow: 'hidden',
  },
});
