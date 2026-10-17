import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import {
  ArrowCounterClockwise,
  ArrowRight,
  Camera,
  FolderOpen,
  MagnifyingGlass,
  Warning,
  X,
} from 'phosphor-react-native';
import { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Cover } from '@/components/cover';
import { PressableScale } from '@/components/pressable-scale';
import { contentWidth, GUTTER } from '@/components/screen';
import { Skeleton } from '@/components/skeleton';
import { Text } from '@/components/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { MEDIUM_LABEL, remember, UNIT_LABEL, type CatalogItem } from '@/lib/catalog';
import { encodePhoto, findMatches, identifyPhoto, type Identification, type Photo } from '@/lib/identify';
import { libraryKeys, useLibrary } from '@/lib/library';

type State =
  | { phase: 'idle'; notice?: string }
  | { phase: 'reading'; photo: Photo }
  | { phase: 'searching'; photo: Photo; id: Identification }
  | { phase: 'done'; photo: Photo; id: Identification; matches: CatalogItem[] }
  | { phase: 'error'; photo: Photo; message: string };

const TIPS = [
  'Fill the frame with the cover or spine.',
  'Tilt away from lamps and windows to dodge glare.',
  'A back cover works too, if the barcode is sharp.',
];

const CONFIDENCE_LABEL: Record<Identification['confidence'], string> = {
  high: 'Clear read',
  medium: 'Likely',
  low: 'Best guess',
};

const openMatch = (item: CatalogItem) => {
  remember([item]);
  router.replace({ pathname: '/title/[key]', params: { key: item.key } });
};

/* -------------------------------------------------------------------------- */

/** Four accent corner brackets, like a camera's focus frame. */
function FrameCorners({ color }: { color: string }) {
  return (
    <>
      {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
        <View
          key={corner}
          pointerEvents="none"
          style={[
            styles.corner,
            corner.includes('t') ? { top: 14 } : { bottom: 14 },
            corner.includes('l') ? { left: 14 } : { right: 14 },
            {
              borderColor: color,
              borderTopWidth: corner.includes('t') ? 2 : 0,
              borderBottomWidth: corner.includes('b') ? 2 : 0,
              borderLeftWidth: corner.includes('l') ? 2 : 0,
              borderRightWidth: corner.includes('r') ? 2 : 0,
            },
          ]}
        />
      ))}
    </>
  );
}

/** A thin accent line that sweeps over the photo while it is being read. */
function ScanLine({ height, color }: { height: number; color: string }) {
  const y = useSharedValue(0);

  useEffect(() => {
    y.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.cubic) }), -1, true);
    return () => cancelAnimation(y);
  }, [y]);

  const sweep = useAnimatedStyle(() => ({ transform: [{ translateY: y.value * (height - 2) }] }));

  return (
    <Animated.View pointerEvents="none" style={[styles.scanLine, sweep]}>
      <View style={[styles.scanGlow, { backgroundColor: color }]} />
      <View style={[styles.scanCore, { backgroundColor: color }]} />
    </Animated.View>
  );
}

function Viewfinder({
  photo,
  scanning,
  width,
  height,
  onPress,
}: {
  photo: Photo | null;
  scanning: boolean;
  width: number;
  height: number;
  onPress?: () => void;
}) {
  const theme = useTheme();

  return (
    <PressableScale
      scaleTo={onPress ? 0.985 : 1}
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? 'Take a photo of a cover' : undefined}
      style={[styles.viewfinder, { width, height, backgroundColor: theme.surface, borderColor: theme.border }]}>
      {photo ? (
        <Animated.View entering={FadeIn.duration(260)} style={StyleSheet.absoluteFill}>
          <Image source={photo.uri} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors />
          {scanning && <View style={[StyleSheet.absoluteFill, { backgroundColor: `${theme.background}33` }]} />}
        </Animated.View>
      ) : (
        <View style={styles.viewfinderEmpty}>
          {/* A ghost cover, so the frame reads as "put a book here". */}
          <View style={[styles.ghostCover, { borderColor: theme.border, backgroundColor: theme.background }]}>
            <View style={[styles.ghostRule, { backgroundColor: theme.accent }]} />
            <View style={[styles.ghostLine, { backgroundColor: theme.surfaceStrong, width: '78%' }]} />
            <View style={[styles.ghostLine, { backgroundColor: theme.surfaceStrong, width: '56%' }]} />
          </View>
          <Text variant="label" tone="textSecondary">
            Cover, spine or barcode
          </Text>
        </View>
      )}
      <FrameCorners color={photo ? theme.onAccent : theme.accent} />
      {scanning && <ScanLine height={height} color={theme.accent} />}
    </PressableScale>
  );
}

function Steps({ phase }: { phase: 'reading' | 'searching' }) {
  const steps = [
    { key: 'reading', label: 'Reading the photo' },
    { key: 'searching', label: 'Searching the catalogs' },
  ] as const;
  const active = steps.findIndex((s) => s.key === phase);

  return (
    <View style={styles.steps} accessibilityLiveRegion="polite">
      {steps.map((step, index) => (
        <View key={step.key} style={styles.step}>
          <Text variant="mono" tone={index <= active ? 'accent' : 'textTertiary'}>
            {String(index + 1).padStart(2, '0')}
          </Text>
          <Text variant="label" tone={index === active ? 'text' : index < active ? 'textSecondary' : 'textTertiary'}>
            {step.label}
            {index === active ? '...' : ''}
          </Text>
        </View>
      ))}
    </View>
  );
}

function MatchRow({ item, owned, best }: { item: CatalogItem; owned: boolean; best?: boolean }) {
  const theme = useTheme();
  const meta = [
    MEDIUM_LABEL[item.medium],
    item.year,
    item.totalUnits ? `${item.totalUnits} ${UNIT_LABEL[item.unit].many}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <PressableScale
      scaleTo={0.985}
      onPress={() => openMatch(item)}
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.title}`}
      style={[
        styles.match,
        best && [styles.bestMatch, { backgroundColor: theme.surface, borderColor: theme.border }],
      ]}>
      <Cover
        uri={item.coverUrl}
        title={item.title}
        width={best ? 76 : 48}
        radius={4}
        label={MEDIUM_LABEL[item.medium]}
        byline={item.authors[0]}
      />
      <View style={styles.matchText}>
        <Text variant={best ? 'title' : 'heading'} numberOfLines={2}>
          {item.title}
        </Text>
        {item.authors.length > 0 && (
          <Text variant="caption" tone="textSecondary" numberOfLines={1}>
            {item.authors.join(', ')}
          </Text>
        )}
        <Text variant="caption" tone="textTertiary">
          {owned ? `On your shelf · ${meta}` : meta}
        </Text>
      </View>
      <ArrowRight size={best ? 20 : 16} color={best ? theme.accent : theme.textTertiary} weight={best ? 'bold' : 'regular'} />
    </PressableScale>
  );
}

function ResultsSkeleton() {
  return (
    <View style={{ gap: Spacing.three }}>
      <Skeleton width={110} height={12} />
      <Skeleton width="70%" height={26} />
      <Skeleton width="100%" height={138} radius={Radius.lg} style={{ marginTop: Spacing.three }} />
    </View>
  );
}

/* -------------------------------------------------------------------------- */

export default function FindScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const width = contentWidth(windowWidth);
  const frameWidth = Math.min(width - GUTTER * 2, 440);

  const [state, setState] = useState<State>({ phase: 'idle' });
  const run = useRef(0);
  const library = useLibrary();
  const owned = libraryKeys(library.data);

  // Leaving the screen mid-scan must not let a late answer write into it.
  useEffect(() => () => void run.current++, []);

  const identify = async (photo: Photo) => {
    const id = ++run.current;
    setState({ phase: 'reading', photo });
    try {
      const identification = await identifyPhoto(await encodePhoto(photo));
      if (id !== run.current) return;
      if (!identification.found) {
        setState({ phase: 'done', photo, id: identification, matches: [] });
        return;
      }
      setState({ phase: 'searching', photo, id: identification });
      const matches = await findMatches(identification);
      if (id !== run.current) return;
      setState({ phase: 'done', photo, id: identification, matches });
    } catch (error) {
      if (id !== run.current) return;
      setState({ phase: 'error', photo, message: error instanceof Error ? error.message : 'Something went wrong.' });
    }
  };

  const pick = async (source: 'camera' | 'library') => {
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
    if (source === 'camera' && Platform.OS !== 'web') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setState({
          phase: 'idle',
          notice: 'Shelf needs camera access to scan covers. You can turn it on in Settings, or choose a photo instead.',
        });
        return;
      }
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    void identify({ uri: asset.uri, width: asset.width, height: asset.height });
  };

  const reset = () => {
    run.current++;
    setState({ phase: 'idle' });
  };

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const photo = state.phase === 'idle' ? null : state.photo;
  const busy = state.phase === 'reading' || state.phase === 'searching';
  const identification = state.phase === 'searching' || state.phase === 'done' ? state.id : null;
  const query = identification?.search_query ?? identification?.title ?? null;
  // Before a photo, keep the frame short enough that both buttons sit above the fold.
  // With a photo, give it a cover's proportions.
  const frameHeight = Math.round(
    photo ? Math.min(frameWidth * 1.25, windowHeight * 0.55) : Math.min(frameWidth * 0.82, windowHeight * 0.36),
  );

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { width, paddingTop: insets.top + Spacing.two, paddingBottom: insets.bottom + Spacing.seven },
        ]}>
        <View style={styles.topBar}>
          <PressableScale
            accessibilityLabel="Close"
            onPress={close}
            style={[styles.iconButton, { borderColor: theme.border, backgroundColor: theme.surface }]}>
            <X size={18} color={theme.text} weight="bold" />
          </PressableScale>
          <Text variant="eyebrow" tone="textTertiary">
            Find this book
          </Text>
        </View>

        {state.phase === 'idle' && (
          <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.intro}>
            <Text variant="display">Show Shelf the cover.</Text>
            <Text tone="textSecondary" style={styles.lede}>
              Take a photo of a book, manga or comic, or pick one from your files. Shelf reads it and finds the title in
              the catalogs.
            </Text>
          </Animated.View>
        )}

        <View style={[styles.frameWrap, { width: frameWidth }]}>
          <Viewfinder
            photo={photo}
            scanning={busy}
            width={frameWidth}
            height={frameHeight}
            onPress={state.phase === 'idle' ? () => void pick('camera') : undefined}
          />
        </View>

        {state.phase === 'idle' && (
          <Animated.View entering={FadeInDown.delay(80).springify().damping(18)} style={styles.block}>
            {state.notice && (
              <View style={[styles.notice, { backgroundColor: theme.accentSoft }]}>
                <Warning size={18} color={theme.accent} />
                <Text variant="caption" tone="textSecondary" style={styles.noticeText}>
                  {state.notice}
                </Text>
              </View>
            )}
            <View style={styles.actions}>
              <Button
                grow
                label="Take a photo"
                icon={<Camera size={18} color={theme.onAccent} weight="bold" />}
                onPress={() => void pick('camera')}
              />
              <Button
                grow
                variant="secondary"
                label="Choose a file"
                icon={<FolderOpen size={18} color={theme.text} />}
                onPress={() => void pick('library')}
              />
            </View>
            <View style={[styles.tips, { borderTopColor: theme.border }]}>
              {TIPS.map((tip, index) => (
                <View key={tip} style={styles.tip}>
                  <Text variant="mono" tone="textTertiary">
                    {String(index + 1).padStart(2, '0')}
                  </Text>
                  <Text variant="caption" tone="textSecondary" style={styles.tipText}>
                    {tip}
                  </Text>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        {busy && (
          <Animated.View entering={FadeIn} style={styles.block}>
            <Steps phase={state.phase} />
            {state.phase === 'searching' && state.id.title && (
              <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.readout}>
                <Text variant="eyebrow" tone="accent">
                  Looks like
                </Text>
                <Text variant="title">{state.id.title}</Text>
              </Animated.View>
            )}
            {state.phase === 'reading' && <ResultsSkeleton />}
          </Animated.View>
        )}

        {state.phase === 'done' && (
          <View style={styles.block}>
            {state.id.found && state.id.title ? (
              <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.readout}>
                <View style={styles.readoutHead}>
                  <Text variant="eyebrow" tone="accent">
                    {[state.id.medium ? MEDIUM_LABEL[state.id.medium] : null, state.id.volume ? `Vol. ${state.id.volume}` : null]
                      .filter(Boolean)
                      .join(' · ') || 'Identified'}
                  </Text>
                  <View style={[styles.badge, { borderColor: theme.border }]}>
                    <Text variant="caption" tone="textSecondary">
                      {CONFIDENCE_LABEL[state.id.confidence]}
                    </Text>
                  </View>
                </View>
                <Text variant="display" style={styles.readoutTitle}>
                  {state.id.title}
                </Text>
                {state.id.authors.length > 0 && (
                  <Text variant="label" tone="textSecondary">
                    {state.id.authors.join(', ')}
                  </Text>
                )}
                {state.id.note && (
                  <Text variant="caption" tone="textTertiary" style={styles.lede}>
                    {state.id.note}
                  </Text>
                )}
              </Animated.View>
            ) : (
              <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.readout}>
                <Text variant="title">No book in that photo.</Text>
                <Text tone="textSecondary" style={styles.lede}>
                  {state.id.note ?? 'Try again with the cover filling the frame and the title in focus.'}
                </Text>
              </Animated.View>
            )}

            {state.matches.length > 0 ? (
              <View style={styles.matches}>
                <Animated.View entering={FadeInDown.delay(60).springify().damping(18)}>
                  <MatchRow item={state.matches[0]} owned={owned.has(state.matches[0].key)} best />
                </Animated.View>
                {state.matches.length > 1 && (
                  <View style={styles.others}>
                    <Text variant="eyebrow" tone="textTertiary">
                      Not it? Other editions and matches
                    </Text>
                    {state.matches.slice(1).map((item, index) => (
                      <Animated.View key={item.key} entering={FadeInDown.delay(120 + index * 40).springify().damping(18)}>
                        <MatchRow item={item} owned={owned.has(item.key)} />
                        {index < state.matches.length - 2 && (
                          <View style={[styles.separator, { backgroundColor: theme.border }]} />
                        )}
                      </Animated.View>
                    ))}
                  </View>
                )}
              </View>
            ) : state.id.found ? (
              <View style={[styles.notice, { backgroundColor: theme.surface }]}>
                <MagnifyingGlass size={18} color={theme.textSecondary} />
                <Text variant="caption" tone="textSecondary" style={styles.noticeText}>
                  The catalogs had no match for it. Try searching by name, or the cover of another edition.
                </Text>
              </View>
            ) : null}

            <View style={styles.actions}>
              <Button
                grow
                variant="secondary"
                label="Scan another"
                icon={<ArrowCounterClockwise size={18} color={theme.text} />}
                onPress={reset}
              />
              {query && (
                <Button
                  grow
                  variant="ghost"
                  label="Search by name"
                  icon={<MagnifyingGlass size={18} color={theme.text} />}
                  onPress={() => router.replace({ pathname: '/search', params: { q: query } })}
                />
              )}
            </View>
          </View>
        )}

        {state.phase === 'error' && (
          <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.block}>
            <View style={[styles.errorBox, { backgroundColor: theme.accentSoft }]}>
              <Text variant="label" tone="danger">
                Could not identify that photo.
              </Text>
              <Text variant="caption" tone="textSecondary">
                {state.message}
              </Text>
            </View>
            <View style={styles.actions}>
              <Button grow label="Try again" onPress={() => void identify(state.photo)} />
              <Button grow variant="secondary" label="New photo" onPress={reset} />
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    alignSelf: 'center',
    paddingHorizontal: GUTTER,
    gap: Spacing.five,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  intro: {
    gap: Spacing.two,
  },
  lede: {
    maxWidth: 380,
  },
  frameWrap: {
    alignSelf: 'flex-start',
  },
  viewfinder: {
    borderRadius: Radius.lg + 6,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
  },
  viewfinderEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
  },
  ghostCover: {
    width: 76,
    height: 114,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: Spacing.three,
    justifyContent: 'flex-end',
    gap: 6,
    transform: [{ rotate: '-4deg' }],
  },
  ghostRule: {
    width: 22,
    height: 2,
    borderRadius: 1,
    marginBottom: 2,
  },
  ghostLine: {
    height: 8,
    borderRadius: 2,
  },
  corner: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 3,
  },
  scanLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  scanGlow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -10,
    height: 22,
    opacity: 0.16,
  },
  scanCore: {
    height: 2,
    opacity: 0.9,
  },
  block: {
    gap: Spacing.five,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  tips: {
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    paddingTop: Spacing.four,
    gap: Spacing.three,
  },
  tip: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.three,
  },
  tipText: {
    flex: 1,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Radius.lg,
  },
  noticeText: {
    flex: 1,
  },
  steps: {
    gap: Spacing.two,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.three,
  },
  readout: {
    gap: Spacing.two,
  },
  readoutHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  readoutTitle: {
    fontSize: 30,
    lineHeight: 34,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  matches: {
    gap: Spacing.five,
  },
  match: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
    paddingVertical: Spacing.three,
  },
  bestMatch: {
    padding: Spacing.four,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  matchText: {
    flex: 1,
    gap: 3,
  },
  others: {
    gap: Spacing.one,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 48 + Spacing.four,
  },
  errorBox: {
    gap: Spacing.two,
    padding: Spacing.four,
    borderRadius: Radius.lg,
  },
});
