import { Image } from 'expo-image';
import { router } from 'expo-router';
import {
  ArrowRight,
  CaretLeft,
  Check,
  GenderFemale,
  GenderMale,
  X,
  type IconProps,
} from 'phosphor-react-native';
import { useEffect, useRef, useState, type ComponentType } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  FadeInLeft,
  FadeInRight,
  FadeOutLeft,
  FadeOutRight,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { PressableScale } from '@/components/pressable-scale';
import { GUTTER } from '@/components/screen';
import { Text } from '@/components/text';
import { SAMPLE_COVERS } from '@/constants/covers';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Medium } from '@/lib/catalog';
import { CANONICAL_GENRES, type Genre } from '@/lib/genres';
import { useProfile, useSaveProfile, type Reader } from '@/lib/profile';

const STEPS = 3;

const READERS: {
  value: Reader;
  label: string;
  caption: string;
  mark: string;
  Icon: ComponentType<IconProps>;
}[] = [
  {
    value: 'men',
    label: 'Men',
    caption: 'Leans toward shounen and seinen manga',
    mark: 'Masculine',
    Icon: GenderMale,
  },
  {
    value: 'women',
    label: 'Women',
    caption: 'Leans toward shoujo and josei manga',
    mark: 'Feminine',
    Icon: GenderFemale,
  },
];

const FORMATS: { value: Medium; label: string; caption: string }[] = [
  { value: 'manga', label: 'Manga', caption: 'Japanese manga, plus manhwa and manhua' },
  { value: 'comic', label: 'Comics', caption: 'Graphic novels and Western comics' },
  { value: 'book', label: 'Books', caption: 'Novels, series and nonfiction' },
];

function StepBar({ step }: { step: number }) {
  const theme = useTheme();
  return (
    <View style={styles.stepBar}>
      {Array.from({ length: STEPS }, (_, i) => (
        <Segment key={i} filled={i <= step} track={theme.surfaceStrong} fill={theme.text} />
      ))}
    </View>
  );
}

function Segment({ filled, track, fill }: { filled: boolean; track: string; fill: string }) {
  const style = useAnimatedStyle(() => ({
    transform: [{ scaleX: withSpring(filled ? 1 : 0, { stiffness: 180, damping: 22 }) }],
  }));
  return (
    <View style={[styles.segment, { backgroundColor: track }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: fill, transformOrigin: 'left' }, style]} />
    </View>
  );
}

function Question({ eyebrow, title, hint }: { eyebrow: string; title: string; hint: string }) {
  return (
    <View style={styles.question}>
      <Text variant="eyebrow" tone="accent">
        {eyebrow}
      </Text>
      <Text variant="display">{title}</Text>
      <Text tone="textSecondary">{hint}</Text>
    </View>
  );
}

function ReaderTile({
  label,
  caption,
  mark,
  Icon,
  selected,
  onPress,
}: {
  label: string;
  caption: string;
  mark: string;
  Icon: ComponentType<IconProps>;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <PressableScale
      haptic
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[
        styles.readerTile,
        selected
          ? { backgroundColor: theme.text, borderColor: theme.text }
          : { backgroundColor: theme.surface, borderColor: theme.border },
      ]}>
      <View style={[styles.tick, { borderColor: selected ? theme.background : theme.border }]}>
        {selected && <Check size={12} color={theme.background} weight="bold" />}
      </View>
      <View style={{ gap: Spacing.two }}>
        <Text variant="display" tone={selected ? 'background' : 'text'}>
          {label}
        </Text>
        <Text variant="caption" tone={selected ? 'background' : 'textSecondary'} style={{ opacity: selected ? 0.75 : 1 }}>
          {caption}
        </Text>
      </View>
      <View style={[styles.mark, { borderTopColor: selected ? theme.textSecondary : theme.border }]}>
        <Icon size={18} color={selected ? theme.background : theme.accent} weight="bold" />
        <Text variant="eyebrow" tone={selected ? 'background' : 'textSecondary'}>
          {mark}
        </Text>
      </View>
    </PressableScale>
  );
}

function FormatRow({
  value,
  label,
  caption,
  selected,
  onPress,
}: {
  value: Medium;
  label: string;
  caption: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <PressableScale
      haptic
      scaleTo={0.98}
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      style={[
        styles.formatRow,
        { backgroundColor: theme.surface, borderColor: selected ? theme.text : theme.border },
      ]}>
      <Image source={SAMPLE_COVERS[value]} style={styles.formatCover} contentFit="cover" />
      <View style={styles.formatText}>
        <Text variant="title">{label}</Text>
        <Text variant="caption" tone="textSecondary">
          {caption}
        </Text>
      </View>
      <View
        style={[
          styles.checkbox,
          selected
            ? { backgroundColor: theme.accent, borderColor: theme.accent }
            : { backgroundColor: 'transparent', borderColor: theme.border },
        ]}>
        {selected && <Check size={14} color={theme.onAccent} weight="bold" />}
      </View>
    </PressableScale>
  );
}

export default function Onboarding() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const profile = useProfile();
  const save = useSaveProfile();
  const editing = !!profile.data?.onboardedAt;

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [reader, setReader] = useState<Reader | null>(profile.data?.reader ?? null);
  const [readerAnswered, setReaderAnswered] = useState(editing);
  const [formats, setFormats] = useState<Medium[]>(profile.data?.formats ?? []);
  const [genres, setGenres] = useState<Genre[]>(profile.data?.genres ?? []);
  const advanceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(advanceTimer.current), []);

  const go = (next: number) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };

  const chooseReader = (value: Reader | null) => {
    setReader(value);
    setReaderAnswered(true);
    // A single-choice question can move on by itself after a beat.
    clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => go(1), 280);
  };

  const toggle = <T,>(list: T[], value: T) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const canContinue = [readerAnswered, formats.length > 0, genres.length > 0][step];

  async function finish() {
    await save.mutateAsync({ reader, formats, genres });
    if (editing && router.canGoBack()) router.back();
    else router.replace('/discover');
  }

  const entering = (direction === 1 ? FadeInRight : FadeInLeft).springify().damping(20);
  const exiting = (direction === 1 ? FadeOutLeft : FadeOutRight).duration(160);

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, Spacing.four) }]}>
      <View style={styles.column}>
        <View style={styles.topBar}>
          {step > 0 || editing ? (
            <PressableScale
              accessibilityLabel={step > 0 ? 'Previous question' : 'Close'}
              onPress={() => (step > 0 ? go(step - 1) : router.back())}
              style={[styles.iconButton, { borderColor: theme.border }]}>
              {step > 0 ? (
                <CaretLeft size={18} color={theme.text} weight="bold" />
              ) : (
                <X size={18} color={theme.text} weight="bold" />
              )}
            </PressableScale>
          ) : (
            <View style={styles.iconButton} />
          )}
          <StepBar step={step} />
          <Text variant="mono" tone="textTertiary" style={styles.counter}>
            {String(step + 1).padStart(2, '0')} / {String(STEPS).padStart(2, '0')}
          </Text>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Animated.View key={step} entering={entering} exiting={exiting} style={styles.stepBody}>
            {step === 0 && (
              <>
                <Question
                  eyebrow="Let's set up your picks"
                  title="Who are we picking for?"
                  hint="This only nudges which manga you see first. You can change it any time."
                />
                <View style={styles.readerRow}>
                  {READERS.map((r) => (
                    <ReaderTile
                      key={r.value}
                      label={r.label}
                      caption={r.caption}
                      mark={r.mark}
                      Icon={r.Icon}
                      selected={readerAnswered && reader === r.value}
                      onPress={() => chooseReader(r.value)}
                    />
                  ))}
                </View>
                <PressableScale onPress={() => chooseReader(null)} style={styles.skip}>
                  <Text
                    variant="label"
                    tone={readerAnswered && reader === null ? 'text' : 'textSecondary'}
                    style={styles.underline}>
                    Prefer not to say
                  </Text>
                </PressableScale>
              </>
            )}

            {step === 1 && (
              <>
                <Question eyebrow="Formats" title="What do you read?" hint="Pick as many as you like." />
                <View style={styles.formatList}>
                  {FORMATS.map((f) => (
                    <FormatRow
                      key={f.value}
                      {...f}
                      selected={formats.includes(f.value)}
                      onPress={() => setFormats(toggle(formats, f.value))}
                    />
                  ))}
                </View>
              </>
            )}

            {step === 2 && (
              <>
                <Question
                  eyebrow="Genres"
                  title="Which genres pull you in?"
                  hint="Pick at least one. Three or more gives sharper picks."
                />
                <View style={styles.genreWrap}>
                  {CANONICAL_GENRES.map((g) => (
                    <Chip key={g} label={g} selected={genres.includes(g)} onPress={() => setGenres(toggle(genres, g))} />
                  ))}
                </View>
              </>
            )}
          </Animated.View>
        </ScrollView>

        <View style={styles.footer}>
          {save.isError && (
            <Text variant="caption" tone="danger">
              Could not save your answers: {save.error.message}
            </Text>
          )}
          <View style={styles.footerRow}>
            <Text variant="mono" tone="textTertiary" style={styles.selection}>
              {step === 1 && formats.length > 0 ? `${formats.length} picked` : ''}
              {step === 2 && genres.length > 0 ? `${genres.length} picked` : ''}
            </Text>
            <Button
              label={step < STEPS - 1 ? 'Continue' : editing ? 'Save' : 'Show my picks'}
              icon={<ArrowRight size={16} color={theme.onAccent} weight="bold" />}
              iconAfter
              disabled={!canContinue}
              loading={save.isPending}
              onPress={() => (step < STEPS - 1 ? go(step + 1) : finish())}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
  },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth / 1.3,
    paddingHorizontal: GUTTER,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
    paddingVertical: Spacing.three,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBar: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  segment: {
    flex: 1,
    height: 3,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  counter: {
    minWidth: 52,
    textAlign: 'right',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: Spacing.five,
    paddingBottom: Spacing.six,
  },
  stepBody: {
    gap: Spacing.six,
  },
  question: {
    gap: Spacing.three,
    paddingRight: Spacing.five,
  },
  readerRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  readerTile: {
    flex: 1,
    minHeight: 240,
    gap: Spacing.four,
    padding: Spacing.four,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    justifyContent: 'space-between',
  },
  mark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
  },
  tick: {
    width: 22,
    height: 22,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skip: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.two,
    marginTop: -Spacing.three,
  },
  underline: {
    textDecorationLine: 'underline',
  },
  formatList: {
    gap: Spacing.three,
  },
  formatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
    padding: Spacing.three,
    paddingRight: Spacing.four,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
  },
  formatCover: {
    width: 52,
    height: 78,
    borderRadius: 4,
  },
  formatText: {
    flex: 1,
    gap: Spacing.one,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genreWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  footer: {
    gap: Spacing.two,
    paddingTop: Spacing.three,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selection: {
    flex: 1,
  },
});
