import { router } from 'expo-router';
import { ArrowRight, Books, Plus, Scan, ShieldCheck, SignOut } from 'phosphor-react-native';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Cover } from '@/components/cover';
import { CoverTile, openTitle } from '@/components/cover-tile';
import { EmptyState } from '@/components/empty-state';
import { PressableScale } from '@/components/pressable-scale';
import { ProgressBar } from '@/components/progress-bar';
import { contentWidth, GUTTER, ScreenHeader, TAB_BAR_CLEARANCE } from '@/components/screen';
import { Skeleton } from '@/components/skeleton';
import { Text } from '@/components/text';
import { COVER_RATIO, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useIsAdmin } from '@/lib/admin';
import { MEDIUM_LABEL, UNIT_LABEL } from '@/lib/catalog';
import {
  STATUS_LABEL,
  STATUS_ORDER,
  useLibrary,
  useUpdateEntry,
  type LibraryEntry,
  type ReadStatus,
} from '@/lib/library';
import { supabase } from '@/lib/supabase';

const COLUMNS = 3;
const GRID_GAP = Spacing.four;

type Filter = 'all' | Exclude<ReadStatus, 'reading'>;

function ReadingCard({ entry }: { entry: LibraryEntry }) {
  const theme = useTheme();
  const update = useUpdateEntry();
  const { item } = entry;
  const unit = UNIT_LABEL[item.unit];
  const step = item.unit === 'page' ? 10 : 1;

  return (
    <PressableScale
      onPress={() => openTitle(item)}
      style={[styles.readingCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Cover uri={item.coverUrl} title={item.title} width={64} label={MEDIUM_LABEL[item.medium]} byline={item.authors[0]} />
      <View style={styles.readingBody}>
        <View style={styles.readingText}>
          <Text variant="eyebrow" tone="textTertiary">
            {MEDIUM_LABEL[item.medium]}
          </Text>
          <Text variant="heading" numberOfLines={2}>
            {item.title}
          </Text>
        </View>
        <View style={styles.readingProgress}>
          <View style={styles.readingRow}>
            <Text variant="mono" tone="textSecondary">
              {unit.short} {entry.progress}
              {item.totalUnits ? ` / ${item.totalUnits}` : ''}
            </Text>
            <PressableScale
              haptic
              scaleTo={0.85}
              accessibilityLabel={`Add ${step} ${step === 1 ? unit.one : unit.many}`}
              onPress={() => update.mutate({ id: entry.id, patch: { progress: entry.progress + step } })}
              style={[styles.bump, { backgroundColor: theme.text }]}>
              <Plus size={14} color={theme.background} weight="bold" />
            </PressableScale>
          </View>
          <ProgressBar value={item.totalUnits ? entry.progress / item.totalUnits : 0} />
        </View>
      </View>
    </PressableScale>
  );
}

function ShelfSkeleton({ tileWidth }: { tileWidth: number }) {
  return (
    <View style={{ gap: Spacing.six }}>
      <View style={styles.readingStrip}>
        <Skeleton width={280} height={128} radius={Radius.lg} />
        <Skeleton width={280} height={128} radius={Radius.lg} />
      </View>
      <View style={styles.skeletonGrid}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} width={tileWidth} height={tileWidth * COVER_RATIO} />
        ))}
      </View>
    </View>
  );
}

export default function ShelfScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const width = contentWidth(windowWidth);
  const tileWidth = Math.floor((width - GUTTER * 2 - GRID_GAP * (COLUMNS - 1)) / COLUMNS);

  const library = useLibrary();
  const isAdmin = useIsAdmin();
  const [filter, setFilter] = useState<Filter>('all');

  const entries = useMemo(() => library.data ?? [], [library.data]);
  const reading = entries.filter((e) => e.status === 'reading');
  const counts = useMemo(() => {
    const result = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<ReadStatus, number>;
    for (const e of entries) result[e.status]++;
    return result;
  }, [entries]);
  const shelved = entries.filter((e) =>
    filter === 'all' ? e.status !== 'reading' : e.status === filter,
  );
  const summary = (['reading', 'planned', 'completed'] as const)
    .filter((s) => counts[s] > 0)
    .map((s) => `${counts[s]} ${s === 'planned' ? 'up next' : STATUS_LABEL[s].toLowerCase()}`)
    .join('  ·  ');
  const nextUp = entries.find((e) => e.status === 'planned');
  // Chips only earn their space when they split the shelf into more than one group.
  const buckets = (['planned', 'completed', 'on_hold', 'dropped'] as const).filter((s) => counts[s] > 0);

  const header = (
    <View>
      <ScreenHeader
        eyebrow={entries.length ? `${entries.length} ${entries.length === 1 ? 'title' : 'titles'}` : undefined}
        title="Shelf"
        subtitle={summary || undefined}
        trailing={
          <View style={styles.headerActions}>
            {isAdmin.data && (
              <PressableScale
                accessibilityLabel="Open admin dashboard"
                onPress={() => router.push('/admin')}
                style={[styles.iconButton, { borderColor: theme.border }]}>
                <ShieldCheck size={18} color={theme.accent} />
              </PressableScale>
            )}
            <PressableScale
              accessibilityLabel="Sign out"
              onPress={() => supabase.auth.signOut()}
              style={[styles.iconButton, { borderColor: theme.border }]}>
              <SignOut size={18} color={theme.textSecondary} />
            </PressableScale>
          </View>
        }
      />

      {library.isPending && <ShelfSkeleton tileWidth={tileWidth} />}

      {library.isError && (
        <View style={[styles.errorBox, { backgroundColor: theme.accentSoft }]}>
          <Text variant="label" tone="danger">
            Could not load your shelf.
          </Text>
          <Text variant="caption" tone="textSecondary">
            {library.error.message}
          </Text>
          <Button label="Try again" variant="ghost" onPress={() => library.refetch()} />
        </View>
      )}

      {library.isSuccess && entries.length === 0 && (
        <EmptyState
          icon={<Books size={40} color={theme.accent} weight="duotone" />}
          title="Nothing on the shelf yet"
          body="Search for a book, manga or comic you are reading, have read, or want to read next."
          action={
            <View style={styles.emptyActions}>
              <Button label="Find something to read" onPress={() => router.navigate('/search')} />
              <Button
                variant="ghost"
                label="Scan a cover"
                icon={<Scan size={18} color={theme.text} />}
                onPress={() => router.push('/find')}
              />
            </View>
          }
        />
      )}

      {library.isSuccess && entries.length > 0 && reading.length === 0 && (
        <PressableScale
          scaleTo={0.985}
          onPress={() => (nextUp ? openTitle(nextUp.item) : router.push('/find'))}
          accessibilityRole="button"
          style={[styles.nudge, { borderColor: theme.border }]}>
          <View style={styles.nudgeText}>
            <Text variant="heading">Nothing in progress</Text>
            <Text variant="caption" tone="textSecondary">
              {nextUp
                ? `Start ${nextUp.item.title}? It is first in your up next.`
                : 'Scan the cover of whatever is on your nightstand.'}
            </Text>
          </View>
          <View style={[styles.nudgeIcon, { backgroundColor: theme.accentSoft }]}>
            {nextUp ? (
              <ArrowRight size={18} color={theme.accent} weight="bold" />
            ) : (
              <Scan size={18} color={theme.accent} weight="bold" />
            )}
          </View>
        </PressableScale>
      )}

      {reading.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text variant="heading">Reading now</Text>
            <Text variant="mono" tone="textTertiary">
              {reading.length}
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.readingStrip}
            style={styles.bleed}>
            {reading.map((entry, index) => (
              <Animated.View key={entry.id} entering={FadeInDown.delay(index * 50).springify().damping(18)}>
                <ReadingCard entry={entry} />
              </Animated.View>
            ))}
          </ScrollView>
        </View>
      )}

      {buckets.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
          style={[styles.bleed, styles.filterBar]}>
          <Chip
            label="All"
            count={entries.length - reading.length}
            selected={filter === 'all'}
            onPress={() => setFilter('all')}
          />
          {buckets.map((status) => (
              <Chip
                key={status}
                label={STATUS_LABEL[status]}
                count={counts[status]}
                selected={filter === status}
                onPress={() => setFilter(status)}
              />
            ))}
        </ScrollView>
      )}
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <FlatList
        key={COLUMNS}
        data={shelved}
        keyExtractor={(e) => e.id}
        numColumns={COLUMNS}
        ListHeaderComponent={header}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={[styles.content, { width, paddingBottom: TAB_BAR_CLEARANCE + insets.bottom }]}
        style={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={library.isRefetching}
            onRefresh={() => void library.refetch()}
            tintColor={theme.textTertiary}
          />
        }
        renderItem={({ item: entry, index }) => (
          <Animated.View entering={index < 12 ? FadeInDown.delay(index * 35).springify().damping(18) : undefined}>
            <CoverTile
              item={entry.item}
              width={tileWidth}
              meta={[MEDIUM_LABEL[entry.item.medium], entry.rating ? `${entry.rating}/10` : null]
                .filter(Boolean)
                .join(' · ')}
            />
          </Animated.View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
  },
  list: {
    alignSelf: 'stretch',
  },
  content: {
    alignSelf: 'center',
    paddingHorizontal: GUTTER,
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.two,
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
  section: {
    marginBottom: Spacing.six,
    gap: Spacing.three,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  bleed: {
    marginHorizontal: -GUTTER,
  },
  readingStrip: {
    flexDirection: 'row',
    gap: Spacing.three,
    paddingHorizontal: GUTTER,
    paddingBottom: Spacing.two,
  },
  readingCard: {
    width: 290,
    flexDirection: 'row',
    gap: Spacing.four,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  readingBody: {
    flex: 1,
    justifyContent: 'space-between',
  },
  readingText: {
    gap: Spacing.one,
  },
  readingProgress: {
    gap: Spacing.two,
  },
  readingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bump: {
    width: 28,
    height: 28,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  nudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
    paddingVertical: Spacing.four,
    marginBottom: Spacing.five,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
  },
  nudgeText: {
    flex: 1,
    gap: 3,
  },
  nudgeIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBar: {
    marginBottom: Spacing.five,
  },
  filters: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: GUTTER,
  },
  gridRow: {
    gap: GRID_GAP,
    marginBottom: Spacing.five,
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  errorBox: {
    gap: Spacing.two,
    padding: Spacing.four,
    borderRadius: Radius.lg,
    alignItems: 'flex-start',
  },
});
