import { router, useLocalSearchParams } from 'expo-router';
import { Bug, ChatCircleDots, CheckCircle, Lightbulb, PaperPlaneTilt, X, type IconProps } from 'phosphor-react-native';
import { useState, type ComponentType } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { PressableScale } from '@/components/pressable-scale';
import { contentWidth, GUTTER } from '@/components/screen';
import { Text } from '@/components/text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { FEEDBACK_KIND_LABEL, FEEDBACK_MAX_LENGTH, useSendFeedback, type FeedbackKind } from '@/lib/feedback';

const KINDS: { kind: FeedbackKind; Icon: ComponentType<IconProps>; hint: string }[] = [
  { kind: 'idea', Icon: Lightbulb, hint: 'Something Shelf could do, or do better' },
  { kind: 'bug', Icon: Bug, hint: 'What you did, what you expected, what happened' },
  { kind: 'other', Icon: ChatCircleDots, hint: 'Anything else on your mind' },
];

const PLACEHOLDER: Record<FeedbackKind, string> = {
  idea: 'It would be great if Shelf could...',
  bug: 'I tapped... and expected... but instead...',
  other: 'Say anything.',
};

function KindOption({
  kind,
  Icon,
  hint,
  selected,
  onPress,
}: (typeof KINDS)[number] & { selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <PressableScale
      haptic
      scaleTo={0.98}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={FEEDBACK_KIND_LABEL[kind]}
      style={[
        styles.kind,
        selected
          ? { backgroundColor: theme.text, borderColor: theme.text }
          : { backgroundColor: theme.surface, borderColor: theme.border },
      ]}>
      <Icon size={20} color={selected ? theme.background : theme.textSecondary} weight={selected ? 'fill' : 'regular'} />
      <View style={styles.kindText}>
        <Text variant="label" tone={selected ? 'background' : 'text'}>
          {FEEDBACK_KIND_LABEL[kind]}
        </Text>
        <Text variant="caption" tone={selected ? 'background' : 'textTertiary'} style={selected && styles.dim}>
          {hint}
        </Text>
      </View>
    </PressableScale>
  );
}

export default function FeedbackScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const width = contentWidth(windowWidth);
  const { from } = useLocalSearchParams<{ from?: string }>();

  const [kind, setKind] = useState<FeedbackKind>('idea');
  const [message, setMessage] = useState('');
  const [focused, setFocused] = useState(false);
  const send = useSendFeedback();

  const trimmed = message.trim();
  const remaining = FEEDBACK_MAX_LENGTH - message.length;
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const submit = () => {
    if (!trimmed || send.isPending) return;
    send.mutate({ kind, message: trimmed, screen: from });
  };

  const startOver = () => {
    send.reset();
    setMessage('');
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
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
            Feedback
          </Text>
        </View>

        {send.isSuccess ? (
          <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.sent}>
            <View style={[styles.sentIcon, { backgroundColor: theme.accentSoft }]}>
              <CheckCircle size={30} color={theme.accent} weight="fill" />
            </View>
            <Text variant="display">Sent.</Text>
            <Text tone="textSecondary" style={styles.lede}>
              It is in the admin inbox now. Thanks for taking the time.
            </Text>
            <View style={styles.actions}>
              <Button grow label="Done" onPress={close} />
              <Button grow variant="secondary" label="Send another" onPress={startOver} />
            </View>
          </Animated.View>
        ) : (
          <>
            <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.intro}>
              <Text variant="display">{"What's on your mind?"}</Text>
              <Text tone="textSecondary" style={styles.lede}>
                Ideas, bugs, a cover that would not scan. It goes straight to the people who run Shelf.
              </Text>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(60).springify().damping(18)} style={styles.block}>
              <Text variant="eyebrow" tone="textTertiary">
                What kind
              </Text>
              <View style={styles.kinds} accessibilityRole="radiogroup">
                {KINDS.map((option) => (
                  <KindOption
                    key={option.kind}
                    {...option}
                    selected={kind === option.kind}
                    onPress={() => setKind(option.kind)}
                  />
                ))}
              </View>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(120).springify().damping(18)} style={styles.block}>
              <View style={styles.labelRow}>
                <Text variant="eyebrow" tone="textTertiary">
                  Your message
                </Text>
                <Text variant="mono" tone={remaining < 100 ? 'accent' : 'textTertiary'}>
                  {remaining}
                </Text>
              </View>
              <TextInput
                value={message}
                onChangeText={setMessage}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder={PLACEHOLDER[kind]}
                placeholderTextColor={theme.textTertiary}
                maxLength={FEEDBACK_MAX_LENGTH}
                multiline
                textAlignVertical="top"
                accessibilityLabel="Your message"
                style={[
                  styles.input,
                  { color: theme.text, backgroundColor: theme.surface, borderColor: focused ? theme.text : theme.border },
                ]}
              />
              {send.isError && (
                <Animated.View entering={FadeIn} style={[styles.errorBox, { backgroundColor: theme.accentSoft }]}>
                  <Text variant="label" tone="danger">
                    Could not send it.
                  </Text>
                  <Text variant="caption" tone="textSecondary">
                    {send.error.message}
                  </Text>
                </Animated.View>
              )}
              <Button
                label="Send feedback"
                icon={<PaperPlaneTilt size={18} color={theme.onAccent} weight="bold" />}
                onPress={submit}
                loading={send.isPending}
                disabled={!trimmed}
              />
            </Animated.View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    alignSelf: 'center',
    paddingHorizontal: GUTTER,
    gap: Spacing.six,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  iconButton: {
    width: 44,
    height: 44,
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
  block: {
    gap: Spacing.three,
  },
  kinds: {
    gap: Spacing.two,
  },
  kind: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  kindText: {
    flex: 1,
    gap: 2,
  },
  dim: {
    opacity: 0.7,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  input: {
    minHeight: 148,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: Spacing.four,
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 22,
  },
  errorBox: {
    gap: Spacing.two,
    padding: Spacing.four,
    borderRadius: Radius.lg,
  },
  sent: {
    gap: Spacing.three,
    paddingTop: Spacing.five,
  },
  sentIcon: {
    width: 56,
    height: 56,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    marginTop: Spacing.four,
  },
});
