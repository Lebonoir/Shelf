import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { BookmarkSimple, BookOpen, CaretLeft, CheckCircle, Minus, Plus, Trash } from 'phosphor-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, {
  Extrapolation,
  FadeIn,
  FadeInDown,
  interpolate,
  LinearTransition,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { CoverRail, CoverRailSkeleton } from '@/components/cover-rail';
import { Cover } from '@/components/cover';
import { PressableScale } from '@/components/pressable-scale';
import { ProgressBar } from '@/components/progress-bar';
import { contentWidth, GUTTER } from '@/components/screen';
import { Skeleton } from '@/components/skeleton';
import { Text } from '@/components/text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fetchTitle, MEDIUM_LABEL, recall, UNIT_LABEL, type CatalogItem } from '@/lib/catalog';
import {
  STATUS_LABEL,
  STATUS_ORDER,
  statusPatch,
  useAddToShelf,
  useEntry,
  useLibrary,
  useRemoveEntry,
  useUpdateEntry,
  type LibraryEntry,
  type ReadStatus,
} from '@/lib/library';
import { useProfile } from '@/lib/profile';
import { similarTitles } from '@/lib/recommend';
import { confirmDestructive } from '@/lib/confirm';

const HERO_HEIGHT = 340;

function Section({ title, children, trailing }: { title: string; children: React.ReactNode; trailing?: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text variant="eyebrow" tone="textTertiary">
          {title}
        </Text>
        {trailing}
      </View>
      {children}
    </View>
  );
}

function AddToShelf({ item }: { item: CatalogItem }) {
  const add = useAddToShelf();
  const theme = useTheme();
  const choose = (status: ReadStatus) => add.mutate({ item, status });

  return (
    <Animated.View entering={FadeIn} style={styles.addBlock}>
      <View style={styles.addRow}>
        <Button
          grow
          label="Reading"
          icon={<BookOpen size={18} color={theme.onAccent} weight="bold" />}
          onPress={() => choose('reading')}
          loading={add.isPending && add.variables?.status === 'reading'}
          disabled={add.isPending}
        />
        <Button
          grow
          variant="secondary"
          label="Up next"
          icon={<BookmarkSimple size={18} color={theme.text} />}
          onPress={() => choose('planned')}
          loading={add.isPending && add.variables?.status === 'planned'}
          disabled={add.isPending}
        />
      </View>
      <Button
        variant="ghost"
        label="Already finished it"
        icon={<CheckCircle size={18} color={theme.text} />}
        onPress={() => choose('completed')}
        loading={add.isPending && add.variables?.status === 'completed'}
        disabled={add.isPending}
      />
      {add.isError && (
        <Text variant="caption" tone="danger">
          Could not add it: {add.error.message}
        </Text>
      )}
    </Animated.View>
  );
}

function ProgressPanel({ entry }: { entry: LibraryEntry }) {
  const theme = useTheme();
  const update = useUpdateEntry();
  const { item } = entry;
  const unit = UNIT_LABEL[item.unit];
  const steps = item.unit === 'page' ? [10, 50] : [1, 5];
  const max = item.totalUnits ?? Number.POSITIVE_INFINITY;

  const setProgress = (value: number) => {
    const progress = Math.max(0, Math.min(max, value));
    const patch: Parameters<typeof update.mutate>[0]['patch'] = { progress };
    if (progress > 0 && entry.status === 'planned') Object.assign(patch, statusPatch(entry, 'reading'), { progress });
    if (item.totalUnits && progress === item.totalUnits && entry.status !== 'completed') {
      Object.assign(patch, statusPatch(entry, 'completed'));
    }
    update.mutate({ id: entry.id, patch });
  };

  return (
    <View style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.progressHead}>
        <Text style={styles.bigNumber}>{entry.progress}</Text>
        <Text variant="mono" tone="textTertiary">
          {item.totalUnits ? `/ ${item.totalUnits} ${unit.many}` : unit.many}
        </Text>
        {item.totalUnits ? (
          <Text variant="mono" tone="accent" style={styles.percent}>
            {Math.round((entry.progress / item.totalUnits) * 100)}%
          </Text>
        ) : null}
      </View>
      {item.totalUnits ? <ProgressBar value={entry.progress / item.totalUnits} height={4} /> : null}
      <View style={styles.stepper}>
        <PressableScale
          haptic
          accessibilityLabel={`Back ${steps[0]} ${unit.many}`}
          onPress={() => setProgress(entry.progress - steps[0])}
          style={[styles.stepButton, { borderColor: theme.border }]}>
          <Minus size={16} color={theme.text} weight="bold" />
        </PressableScale>
        {steps.map((step) => (
          <PressableScale
            key={step}
            haptic
            accessibilityLabel={`Forward ${step} ${step === 1 ? unit.one : unit.many}`}
            onPress={() => setProgress(entry.progress + step)}
            style={[styles.stepButton, styles.stepGrow, { backgroundColor: theme.text, borderColor: theme.text }]}>
            <Plus size={14} color={theme.background} weight="bold" />
            <Text variant="mono" tone="background">
              {step}
            </Text>
          </PressableScale>
        ))}
      </View>
    </View>
  );
}

function RatingPicker({ entry }: { entry: LibraryEntry }) {
  const theme = useTheme();
  const update = useUpdateEntry();
  const rating = entry.rating ?? 0;

  return (
    <View style={styles.ratingRow}>
      {Array.from({ length: 10 }, (_, i) => i + 1).map((value) => {
        const filled = value <= rating;
        return (
          <PressableScale
            key={value}
            haptic
            scaleTo={0.85}
            accessibilityLabel={`Rate ${value} out of 10`}
            accessibilityState={{ selected: value === rating }}
            onPress={() => update.mutate({ id: entry.id, patch: { rating: value === rating ? null : value } })}
            style={[
              styles.ratingCell,
              { backgroundColor: filled ? theme.accent : 'transparent', borderColor: filled ? theme.accent : theme.border },
            ]}>
            <Text variant="mono" tone={filled ? 'onAccent' : 'textTertiary'}>
              {value}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

function Notes({ entry }: { entry: LibraryEntry }) {
  const theme = useTheme();
  const update = useUpdateEntry();
  const [draft, setDraft] = useState(entry.notes ?? '');
  const [focused, setFocused] = useState(false);
  const dirty = draft !== (entry.notes ?? '');

  return (
    <View style={{ gap: Spacing.two }}>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          if (dirty) update.mutate({ id: entry.id, patch: { notes: draft.trim() || null } });
        }}
        placeholder="Favourite arc, a line that stuck, why you dropped it..."
        placeholderTextColor={theme.textTertiary}
        multiline
        textAlignVertical="top"
        accessibilityLabel="Notes"
        style={[
          styles.notes,
          { color: theme.text, backgroundColor: theme.surface, borderColor: focused ? theme.text : theme.border },
        ]}
      />
      <Text variant="caption" tone="textTertiary">
        {update.isPending ? 'Saving...' : dirty ? 'Saves when you leave the field' : entry.notes ? 'Saved' : ' '}
      </Text>
    </View>
  );
}

function ShelfControls({ entry }: { entry: LibraryEntry }) {
  const theme = useTheme();
  const update = useUpdateEntry();
  const remove = useRemoveEntry();

  return (
    <Animated.View entering={FadeIn} layout={LinearTransition.springify().damping(20)} style={{ gap: Spacing.six }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.statusRow}>
        {STATUS_ORDER.map((status) => (
          <Chip
            key={status}
            label={STATUS_LABEL[status]}
            selected={entry.status === status}
            onPress={() => entry.status !== status && update.mutate({ id: entry.id, patch: statusPatch(entry, status) })}
          />
        ))}
      </ScrollView>

      <Section title="Progress">
        <ProgressPanel entry={entry} />
      </Section>

      <Section
        title="Your rating"
        trailing={
          entry.rating ? (
            <Text variant="mono" tone="accent">
              {entry.rating}/10
            </Text>
          ) : null
        }>
        <RatingPicker entry={entry} />
      </Section>

      <Section title="Notes">
        <Notes entry={entry} />
      </Section>

      {(entry.started_at || entry.finished_at) && (
        <View style={styles.dates}>
          {entry.started_at && (
            <Text variant="mono" tone="textTertiary">
              Started {entry.started_at}
            </Text>
          )}
          {entry.finished_at && (
            <Text variant="mono" tone="textTertiary">
              Finished {entry.finished_at}
            </Text>
          )}
        </View>
      )}

      <PressableScale
        onPress={() =>
          confirmDestructive(
            `Remove ${entry.item.title}?`,
            'Your progress, rating and notes for it will be deleted.',
            'Remove',
            () => remove.mutate(entry.id),
          )
        }
        style={[styles.remove, { borderColor: theme.border }]}>
        <Trash size={16} color={theme.danger} />
        <Text variant="label" tone="danger">
          Remove from Shelf
        </Text>
      </PressableScale>
    </Animated.View>
  );
}

function Synopsis({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 360;
  return (
    <PressableScale scaleTo={1} disabled={!long} onPress={() => setOpen(!open)} style={{ gap: Spacing.two }}>
      <Text tone="textSecondary" numberOfLines={open || !long ? undefined : 6} style={styles.synopsis}>
        {text}
      </Text>
      {long && (
        <Text variant="label" tone="text" style={styles.underline}>
          {open ? 'Show less' : 'Read more'}
        </Text>
      )}
    </PressableScale>
  );
}

export default function TitleScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const width = contentWidth(windowWidth);

  const entry = useEntry(key);
  const details = useQuery({
    queryKey: ['title', key],
    queryFn: () => fetchTitle(key),
    placeholderData: () => recall(key) ?? entry.data?.item,
    staleTime: 60 * 60_000,
  });

  const item = details.data ?? entry.data?.item;

  const library = useLibrary();
  const profile = useProfile();
  const similar = useQuery({
    queryKey: ['similar', key, profile.data?.formats],
    queryFn: () => similarTitles(item!, library.data ?? [], profile.data ?? null),
    enabled: !!item && library.isSuccess && !profile.isPending,
    staleTime: 30 * 60_000,
  });
  const coverWidth = Math.min(132, width * 0.34);

  // Once the title scrolls under the back button, a solid bar fades in behind it.
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  const barStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [HERO_HEIGHT - 170, HERO_HEIGHT - 110], [0, 1], Extrapolation.CLAMP),
  }));

  const meta = item
    ? [
        MEDIUM_LABEL[item.medium],
        item.year,
        item.totalUnits ? `${item.totalUnits} ${UNIT_LABEL[item.unit].many}` : null,
      ]
        .filter(Boolean)
        .join('  ·  ')
    : '';

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.seven }}>
        {/* Hero: the cover, blurred and fading into the page. */}
        <View style={[styles.hero, { height: HERO_HEIGHT + insets.top }]}>
          {item?.coverUrl && (
            <Image source={item.coverUrl} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={40} transition={300} />
          )}
          <LinearGradient
            colors={[`${theme.background}66`, `${theme.background}CC`, theme.background]}
            locations={[0, 0.6, 1]}
            style={StyleSheet.absoluteFill}
          />
        </View>

        <View style={[styles.body, { width, marginTop: -(HERO_HEIGHT - 64) }]}>
          {item ? (
            <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.identity}>
              <Cover
                uri={item.coverUrl}
                title={item.title}
                width={coverWidth}
                radius={Radius.sm}
                medium={item.medium}
                byline={item.authors[0]}
              />
              <View style={styles.identityText}>
                <Text variant="eyebrow" tone={item.medium}>
                  {meta}
                </Text>
                <Text variant="display" style={styles.title}>
                  {item.title}
                </Text>
                {item.authors.length > 0 && (
                  <Text variant="label" tone="textSecondary" numberOfLines={2}>
                    {item.authors.join(', ')}
                  </Text>
                )}
              </View>
            </Animated.View>
          ) : details.isError ? (
            <View style={[styles.panel, { backgroundColor: theme.accentSoft, borderColor: 'transparent' }]}>
              <Text variant="label" tone="danger">
                Could not load this title.
              </Text>
              <Text variant="caption" tone="textSecondary">
                {details.error.message}
              </Text>
              <Button label="Try again" variant="ghost" onPress={() => details.refetch()} />
            </View>
          ) : (
            <View style={styles.identity}>
              <Skeleton width={coverWidth} height={coverWidth * 1.5} />
              <View style={[styles.identityText, { gap: Spacing.three }]}>
                <Skeleton width={90} height={12} />
                <Skeleton width="90%" height={30} />
                <Skeleton width="60%" height={14} />
              </View>
            </View>
          )}

          {item && item.genres.length > 0 && (
            <View style={styles.genres}>
              {item.genres.map((genre) => (
                <View key={genre} style={[styles.genre, { borderColor: theme.border }]}>
                  <Text variant="caption" tone="textSecondary">
                    {genre}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {item && !entry.isPending && (entry.data ? <ShelfControls entry={entry.data} /> : <AddToShelf item={item} />)}

          <Section title="About">
            {item?.synopsis ? (
              <Synopsis text={item.synopsis} />
            ) : details.isFetching ? (
              <View style={{ gap: Spacing.two }}>
                <Skeleton width="100%" height={14} />
                <Skeleton width="94%" height={14} />
                <Skeleton width="70%" height={14} />
              </View>
            ) : (
              <Text tone="textTertiary">No description from the catalog for this one.</Text>
            )}
          </Section>

          {similar.isPending && !!item && <CoverRailSkeleton />}
          {similar.data && similar.data.length > 0 && item && (
            <Animated.View entering={FadeIn} style={styles.similar}>
              <CoverRail
                eyebrow="More like this"
                heading={entry.data ? `Since you like ${item.title}` : `If ${item.title} looks good`}
                items={similar.data}
              />
            </Animated.View>
          )}
        </View>
      </Animated.ScrollView>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.bar,
          { height: insets.top + 56, paddingTop: insets.top, backgroundColor: theme.background, borderBottomColor: theme.border },
          barStyle,
        ]}>
        <Text variant="heading" numberOfLines={1} style={styles.barTitle}>
          {item?.title ?? ''}
        </Text>
      </Animated.View>

      <PressableScale
        accessibilityLabel="Go back"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        style={[styles.back, { top: insets.top + Spacing.two, backgroundColor: theme.surface, borderColor: theme.border }]}>
        <CaretLeft size={18} color={theme.text} weight="bold" />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  hero: {
    width: '100%',
    overflow: 'hidden',
  },
  body: {
    alignSelf: 'center',
    paddingHorizontal: GUTTER,
    gap: Spacing.six,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.five - 4,
  },
  identityText: {
    flex: 1,
    gap: Spacing.two,
    paddingBottom: Spacing.one,
  },
  title: {
    fontSize: 28,
    lineHeight: 32,
  },
  genres: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: -Spacing.three,
  },
  genre: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  addBlock: {
    gap: Spacing.three,
  },
  addRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  bleed: {
    marginHorizontal: -GUTTER,
  },
  statusRow: {
    gap: Spacing.two,
    paddingHorizontal: GUTTER,
  },
  section: {
    gap: Spacing.three,
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  panel: {
    padding: Spacing.four,
    gap: Spacing.four,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'stretch',
  },
  progressHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  bigNumber: {
    fontFamily: Fonts.mono,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -1.2,
  },
  percent: {
    marginLeft: 'auto',
  },
  stepper: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  stepButton: {
    minHeight: 44,
    minWidth: 52,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  stepGrow: {
    flex: 1,
  },
  ratingRow: {
    flexDirection: 'row',
    gap: 5,
  },
  ratingCell: {
    flex: 1,
    minHeight: 40,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notes: {
    minHeight: 104,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: Spacing.four,
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 22,
  },
  dates: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: Spacing.five,
    rowGap: Spacing.one,
  },
  remove: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    minHeight: 46,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderStyle: 'dashed',
  },
  synopsis: {
    maxWidth: 620,
  },
  similar: {
    marginTop: Spacing.two,
  },
  underline: {
    textDecorationLine: 'underline',
  },
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  barTitle: {
    marginLeft: GUTTER + 44 + Spacing.three,
    marginRight: GUTTER,
  },
  back: {
    position: 'absolute',
    left: GUTTER,
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
