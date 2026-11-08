import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { CheckCircle, MagnifyingGlass, Plus, X } from 'phosphor-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Keyboard,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip } from '@/components/chip';
import { Cover } from '@/components/cover';
import { openTitle } from '@/components/cover-tile';
import { EmptyState } from '@/components/empty-state';
import { PressableScale } from '@/components/pressable-scale';
import { contentWidth, GUTTER, ScreenHeader, TAB_BAR_CLEARANCE } from '@/components/screen';
import { Skeleton } from '@/components/skeleton';
import { Text } from '@/components/text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  MEDIUM_LABEL,
  searchBooks,
  searchComics,
  searchEverything,
  searchManga,
  UNIT_LABEL,
  type CatalogItem,
  type Medium,
} from '@/lib/catalog';
import { libraryKeys, useLibrary } from '@/lib/library';

type Scope = 'all' | Medium;

const SCOPES: { value: Scope; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'manga', label: 'Manga' },
  { value: 'book', label: 'Books' },
  { value: 'comic', label: 'Comics' },
];

const SUGGESTIONS = ['Vagabond', 'The Name of the Wind', 'Saga', 'Frieren', 'Piranesi', 'Sandman'];

function runSearch(scope: Scope, query: string): Promise<CatalogItem[]> {
  if (scope === 'manga') return searchManga(query);
  if (scope === 'book') return searchBooks(query);
  if (scope === 'comic') return searchComics(query);
  return searchEverything(query);
}

function useDebounced<T>(value: T, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function ResultRow({ item, owned }: { item: CatalogItem; owned: boolean }) {
  const theme = useTheme();
  const meta = [
    MEDIUM_LABEL[item.medium],
    item.year,
    item.totalUnits ? `${item.totalUnits} ${UNIT_LABEL[item.unit].many}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <PressableScale scaleTo={0.985} onPress={() => openTitle(item)} style={styles.result}>
      <Cover uri={item.coverUrl} title={item.title} width={52} radius={4} medium={item.medium} byline={item.authors[0]} />
      <View style={styles.resultText}>
        <Text variant="heading" numberOfLines={2}>
          {item.title}
        </Text>
        {item.authors.length > 0 && (
          <Text variant="caption" tone="textSecondary" numberOfLines={1}>
            {item.authors.join(', ')}
          </Text>
        )}
        <Text variant="caption" tone="textTertiary">
          {meta}
        </Text>
      </View>
      {owned ? (
        <CheckCircle size={22} color={theme.accent} weight="fill" />
      ) : (
        <Plus size={20} color={theme.textTertiary} />
      )}
    </PressableScale>
  );
}

function ResultsSkeleton() {
  return (
    <View style={{ gap: Spacing.five }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={i} style={styles.result}>
          <Skeleton width={52} height={78} radius={4} />
          <View style={[styles.resultText, { gap: Spacing.two }]}>
            <Skeleton width="80%" height={16} />
            <Skeleton width="45%" height={12} />
            <Skeleton width="30%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

export default function SearchScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const width = contentWidth(windowWidth);

  // `q` lets other screens (e.g. Find this book) open Search with a query typed in.
  const params = useLocalSearchParams<{ q?: string }>();
  const [text, setText] = useState(params.q ?? '');
  const [prefill, setPrefill] = useState(params.q);
  if (params.q !== prefill) {
    setPrefill(params.q);
    if (params.q) setText(params.q);
  }
  const [scope, setScope] = useState<Scope>('all');
  const [focused, setFocused] = useState(false);
  const query = useDebounced(text.trim());

  const library = useLibrary();
  const owned = useMemo(() => libraryKeys(library.data), [library.data]);

  const results = useQuery({
    queryKey: ['search', scope, query],
    queryFn: () => runSearch(scope, query),
    enabled: query.length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });

  const showResults = query.length >= 2;
  const typing = text.trim() !== query;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={[styles.top, { width }]}>
        <ScreenHeader title="Search" eyebrow="Books, manga and comics" />
        <View
          style={[
            styles.searchBox,
            { backgroundColor: theme.surface, borderColor: focused ? theme.text : theme.border },
          ]}>
          <MagnifyingGlass size={18} color={theme.textTertiary} />
          <TextInput
            value={text}
            onChangeText={setText}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Titles, authors, series"
            placeholderTextColor={theme.textTertiary}
            returnKeyType="search"
            autoCorrect={false}
            style={[styles.input, { color: theme.text }]}
            accessibilityLabel="Search titles"
          />
          {text.length > 0 && (
            <PressableScale accessibilityLabel="Clear search" onPress={() => setText('')} hitSlop={10}>
              <X size={16} color={theme.textSecondary} weight="bold" />
            </PressableScale>
          )}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.bleed}
          contentContainerStyle={styles.scopes}
          keyboardShouldPersistTaps="handled">
          {SCOPES.map((s) => (
            <Chip key={s.value} label={s.label} selected={scope === s.value} onPress={() => setScope(s.value)} />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={showResults ? (results.data ?? []) : []}
        keyExtractor={(item) => item.key}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={Keyboard.dismiss}
        style={styles.list}
        contentContainerStyle={[styles.listContent, { width, paddingBottom: TAB_BAR_CLEARANCE + insets.bottom }]}
        ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: theme.border }]} />}
        renderItem={({ item }) => <ResultRow item={item} owned={owned.has(item.key)} />}
        ListHeaderComponent={
          showResults && (results.isFetching || typing) && !results.data ? <ResultsSkeleton /> : undefined
        }
        ListEmptyComponent={
          !showResults ? (
            <Animated.View entering={FadeIn} style={styles.suggestions}>
              <Text variant="eyebrow" tone="textTertiary">
                Try
              </Text>
              <View style={styles.suggestionWrap}>
                {SUGGESTIONS.map((s) => (
                  <Chip key={s} label={s} onPress={() => setText(s)} />
                ))}
              </View>
            </Animated.View>
          ) : results.isError ? (
            <View style={[styles.errorBox, { backgroundColor: theme.accentSoft }]}>
              <Text variant="label" tone="danger">
                Search failed.
              </Text>
              <Text variant="caption" tone="textSecondary">
                {results.error.message}
              </Text>
            </View>
          ) : results.isSuccess && !results.isFetching && !typing ? (
            <EmptyState
              icon={<MagnifyingGlass size={36} color={theme.textTertiary} />}
              title={`Nothing for "${query}"`}
              body={scope === 'all' ? 'Check the spelling, or try the original title.' : 'Try another format, or search All.'}
            />
          ) : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
  },
  top: {
    paddingHorizontal: GUTTER,
    gap: Spacing.three,
    paddingBottom: Spacing.four,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 50,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  input: {
    flex: 1,
    paddingVertical: Spacing.three,
    fontFamily: Fonts.sans,
    fontSize: 16,
  },
  bleed: {
    marginHorizontal: -GUTTER,
    flexGrow: 0,
  },
  scopes: {
    gap: Spacing.two,
    paddingHorizontal: GUTTER,
  },
  list: {
    alignSelf: 'stretch',
  },
  listContent: {
    alignSelf: 'center',
    paddingHorizontal: GUTTER,
    paddingTop: Spacing.two,
  },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
    paddingVertical: Spacing.three,
  },
  resultText: {
    flex: 1,
    gap: 3,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 52 + Spacing.four,
  },
  suggestions: {
    gap: Spacing.three,
    paddingTop: Spacing.four,
  },
  suggestionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  errorBox: {
    gap: Spacing.two,
    padding: Spacing.four,
    borderRadius: Radius.lg,
  },
});
