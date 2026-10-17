import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { SlidersHorizontal } from 'phosphor-react-native';
import { useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { CoverRail, CoverRailSkeleton } from '@/components/cover-rail';
import { PressableScale } from '@/components/pressable-scale';
import { contentWidth, GUTTER, ScreenHeader, TAB_BAR_CLEARANCE } from '@/components/screen';
import { Text } from '@/components/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useLibrary } from '@/lib/library';
import { useProfile } from '@/lib/profile';
import { buildRecommendations, type RecommendationRow } from '@/lib/recommend';

function Row({ row, index }: { row: RecommendationRow; index: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(index * 70).springify().damping(18)}>
      <CoverRail eyebrow={row.eyebrow} heading={row.heading} items={row.items} seedCoverUrl={row.seed?.coverUrl} />
    </Animated.View>
  );
}

function DiscoverSkeleton() {
  return (
    <View style={{ gap: Spacing.seven }}>
      <CoverRailSkeleton />
      <CoverRailSkeleton />
    </View>
  );
}

export default function DiscoverScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const width = contentWidth(windowWidth);
  const library = useLibrary();
  const profile = useProfile();

  // Recompute only when what drives the picks changes, not on every progress bump.
  const signature = useMemo(
    () =>
      (library.data ?? [])
        .map((e) => `${e.item.key}:${e.status}:${e.rating ?? ''}`)
        .sort()
        .join('|'),
    [library.data],
  );

  const recommendations = useQuery({
    queryKey: ['discover', signature, profile.data],
    queryFn: () => buildRecommendations(library.data ?? [], profile.data ?? null),
    enabled: library.isSuccess && !profile.isPending,
    staleTime: 10 * 60_000,
  });

  const rated = library.data?.filter((e) => e.rating !== null).length ?? 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { width, paddingBottom: TAB_BAR_CLEARANCE + insets.bottom }]}
        refreshControl={
          <RefreshControl
            refreshing={recommendations.isRefetching}
            onRefresh={() => void recommendations.refetch()}
            tintColor={theme.textTertiary}
          />
        }>
        <ScreenHeader
          eyebrow="Across every format"
          title="Discover"
          subtitle={
            rated < 3
              ? 'Starting from your answers. Rate a few titles on your shelf and the picks get sharper.'
              : `Built from the ${rated} titles you have rated, plus your answers.`
          }
          trailing={
            <PressableScale
              accessibilityLabel="Edit your reading preferences"
              onPress={() => router.push('/onboarding')}
              style={[styles.iconButton, { borderColor: theme.border }]}>
              <SlidersHorizontal size={18} color={theme.textSecondary} />
            </PressableScale>
          }
        />

        {(library.isPending || recommendations.isPending) && !recommendations.isError && <DiscoverSkeleton />}

        {recommendations.isError && (
          <View style={[styles.errorBox, { backgroundColor: theme.accentSoft }]}>
            <Text variant="label" tone="danger">
              The catalogs did not answer.
            </Text>
            <Text variant="caption" tone="textSecondary">
              {recommendations.error.message}
            </Text>
            <Button label="Try again" variant="ghost" onPress={() => recommendations.refetch()} />
          </View>
        )}

        {recommendations.data && (
          <View style={styles.rows}>
            {recommendations.data.map((row, index) => (
              <Row key={row.id} row={row} index={index} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    alignSelf: 'center',
    paddingHorizontal: GUTTER,
  },
  rows: {
    gap: Spacing.seven,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.two,
  },
  errorBox: {
    gap: Spacing.two,
    padding: Spacing.four,
    borderRadius: Radius.lg,
    alignItems: 'flex-start',
  },
});
