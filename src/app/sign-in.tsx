import { Image } from 'expo-image';
import { Check, Eye, EyeSlash } from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { PressableScale } from '@/components/pressable-scale';
import { GUTTER } from '@/components/screen';
import { Text } from '@/components/text';
import { SAMPLE_COVERS } from '@/constants/covers';
import { Fonts, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getRememberMe, setRememberMe, supabase } from '@/lib/supabase';

/** One of each format: a novel, a manga, a graphic novel. */
const FAN = [
  { uri: SAMPLE_COVERS.book, rotate: -9, x: 0, y: 14 },
  { uri: SAMPLE_COVERS.manga, rotate: 2, x: 58, y: 0 },
  { uri: SAMPLE_COVERS.comic, rotate: 11, x: 116, y: 18 },
];

const LAYOUT = LinearTransition.springify().damping(20);

function CoverFan() {
  const theme = useTheme();
  const drift = useSharedValue(0);

  useEffect(() => {
    drift.value = withRepeat(
      withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(drift);
  }, [drift]);

  const float = useAnimatedStyle(() => ({ transform: [{ translateY: drift.value * -6 }] }));

  return (
    <Animated.View style={[styles.fan, float]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {FAN.map((cover) => (
        <View
          key={cover.uri}
          style={[
            styles.fanCover,
            {
              left: cover.x,
              top: cover.y,
              transform: [{ rotate: `${cover.rotate}deg` }],
              backgroundColor: theme.surfaceStrong,
              shadowColor: theme.shadow,
            },
          ]}>
          <Image source={cover.uri} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
        </View>
      ))}
    </Animated.View>
  );
}

type FieldProps = TextInputProps & {
  label: string;
  error?: string | null;
  optional?: boolean;
  /** Adds a show/hide toggle for passwords. */
  revealable?: boolean;
};

function Field({ label, error, optional, revealable, secureTextEntry, ...input }: FieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const RevealIcon = revealed ? EyeSlash : Eye;

  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text variant="label" tone="textSecondary">
          {label}
        </Text>
        {optional && (
          <Text variant="caption" tone="textTertiary">
            Optional
          </Text>
        )}
      </View>
      <View
        style={[
          styles.inputBox,
          {
            backgroundColor: theme.surface,
            borderColor: error ? theme.danger : focused ? theme.text : theme.border,
          },
        ]}>
        <TextInput
          {...input}
          secureTextEntry={secureTextEntry && !revealed}
          onFocus={(e) => {
            setFocused(true);
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            input.onBlur?.(e);
          }}
          placeholderTextColor={theme.textTertiary}
          style={[styles.input, { color: theme.text }]}
          accessibilityLabel={label}
        />
        {revealable && (
          <PressableScale
            hitSlop={10}
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            onPress={() => setRevealed(!revealed)}>
            <RevealIcon size={18} color={theme.textTertiary} />
          </PressableScale>
        )}
      </View>
      {error && (
        <Animated.View entering={FadeIn.duration(150)}>
          <Text variant="caption" tone="danger">
            {error}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

function RememberMe({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  const theme = useTheme();
  return (
    <PressableScale
      haptic
      scaleTo={0.98}
      onPress={() => onChange(!value)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      style={styles.remember}>
      <View
        style={[
          styles.checkbox,
          value
            ? { backgroundColor: theme.text, borderColor: theme.text }
            : { backgroundColor: 'transparent', borderColor: theme.textTertiary },
        ]}>
        {value && <Check size={12} color={theme.background} weight="bold" />}
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="label">Remember me</Text>
        <Text variant="caption" tone="textTertiary">
          {value ? 'Stay signed in on this device.' : 'You will be signed out when the app closes.'}
        </Text>
      </View>
    </PressableScale>
  );
}

type Errors = Partial<
  Record<'firstName' | 'lastName' | 'email' | 'password' | 'confirm' | 'form', string>
>;

export default function SignIn() {
  const theme = useTheme();
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<Errors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const signingUp = mode === 'sign-up';

  useEffect(() => {
    getRememberMe().then(setRemember);
  }, []);

  function validate(): Errors {
    const next: Errors = {};
    if (signingUp) {
      if (!firstName.trim()) next.firstName = 'Enter your first name.';
      if (!lastName.trim()) next.lastName = 'Enter your last name.';
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = 'Enter a valid email address.';
    if (password.length < 6) next.password = 'Use at least 6 characters.';
    if (signingUp && confirm !== password) next.confirm = 'Passwords do not match.';
    return next;
  }

  async function submit() {
    const next = validate();
    setErrors(next);
    setNotice(null);
    if (Object.keys(next).length) return;

    setBusy(true);
    await setRememberMe(remember);
    const credentials = { email: email.trim(), password };

    if (!signingUp) {
      const { error } = await supabase.auth.signInWithPassword(credentials);
      if (error) setErrors({ form: error.message });
    } else {
      const { data, error } = await supabase.auth.signUp({
        ...credentials,
        options: {
          data: {
            first_name: firstName.trim(),
            middle_name: middleName.trim() || null,
            last_name: lastName.trim(),
          },
        },
      });
      if (error) setErrors({ form: error.message });
      else if (!data.session) {
        setNotice(`We sent a confirmation link to ${credentials.email}. Open it, then sign in here.`);
        setMode('sign-in');
        setPassword('');
        setConfirm('');
      }
    }
    setBusy(false);
  }

  function switchMode() {
    setMode(signingUp ? 'sign-in' : 'sign-up');
    setErrors({});
    setNotice(null);
    setConfirm('');
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.column}>
            <Animated.View entering={FadeInDown.springify().damping(18)}>
              <CoverFan />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(80).springify().damping(18)} style={styles.intro}>
              <Text variant="eyebrow" tone="accent">
                Shelf
              </Text>
              <Text variant="display">
                {signingUp ? 'Make your shelf.' : 'Every book, manga and comic you read, on one shelf.'}
              </Text>
              <Text tone="textSecondary">
                {signingUp
                  ? 'A few details and you are in. We will ask what you like to read next.'
                  : 'Track what you are reading and get picks that cross formats, from Berserk to Dune to Watchmen.'}
              </Text>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(160).springify().damping(18)} layout={LAYOUT} style={styles.form}>
              {signingUp && (
                <Animated.View entering={FadeInDown.springify().damping(20)} exiting={FadeOut.duration(120)} style={styles.form}>
                  <View style={styles.nameRow}>
                    <View style={styles.nameCell}>
                      <Field
                        label="First name"
                        value={firstName}
                        onChangeText={setFirstName}
                        error={errors.firstName}
                        autoComplete="given-name"
                        textContentType="givenName"
                        autoCapitalize="words"
                        placeholder="Mika"
                      />
                    </View>
                    <View style={styles.nameCell}>
                      <Field
                        label="Last name"
                        value={lastName}
                        onChangeText={setLastName}
                        error={errors.lastName}
                        autoComplete="family-name"
                        textContentType="familyName"
                        autoCapitalize="words"
                        placeholder="Santos"
                      />
                    </View>
                  </View>
                  <Field
                    label="Middle name"
                    optional
                    value={middleName}
                    onChangeText={setMiddleName}
                    autoComplete="additional-name"
                    textContentType="middleName"
                    autoCapitalize="words"
                    placeholder="Lee"
                  />
                </Animated.View>
              )}

              <Animated.View layout={LAYOUT} style={styles.form}>
                <Field
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  error={errors.email}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  inputMode="email"
                  placeholder="you@example.com"
                />
                <Field
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  error={errors.password}
                  secureTextEntry
                  revealable
                  autoComplete={signingUp ? 'new-password' : 'current-password'}
                  onSubmitEditing={signingUp ? undefined : submit}
                  placeholder="At least 6 characters"
                />
                {signingUp && (
                  <Animated.View entering={FadeInDown.springify().damping(20)} exiting={FadeOut.duration(120)}>
                    <Field
                      label="Confirm password"
                      value={confirm}
                      onChangeText={setConfirm}
                      error={errors.confirm}
                      secureTextEntry
                      revealable
                      autoComplete="new-password"
                      onSubmitEditing={submit}
                      placeholder="Type it again"
                    />
                  </Animated.View>
                )}

                <RememberMe value={remember} onChange={setRemember} />

                {errors.form && (
                  <View style={[styles.banner, { backgroundColor: theme.accentSoft }]}>
                    <Text variant="caption" tone="danger">
                      {errors.form}
                    </Text>
                  </View>
                )}
                {notice && (
                  <View style={[styles.banner, { backgroundColor: theme.surface }]}>
                    <Text variant="caption" tone="textSecondary">
                      {notice}
                    </Text>
                  </View>
                )}

                <Button label={signingUp ? 'Create account' : 'Sign in'} onPress={submit} loading={busy} />
                <PressableScale onPress={switchMode} style={styles.switch}>
                  <Text variant="label" tone="textSecondary">
                    {signingUp ? 'Have an account? ' : 'New here? '}
                    <Text variant="label" tone="text" style={styles.underline}>
                      {signingUp ? 'Sign in' : 'Create an account'}
                    </Text>
                  </Text>
                </PressableScale>
              </Animated.View>
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: GUTTER,
    paddingVertical: Spacing.six,
    alignItems: 'center',
  },
  column: {
    width: '100%',
    maxWidth: MaxContentWidth / 1.4,
    gap: Spacing.six,
  },
  fan: {
    height: 150,
    width: 210,
    marginLeft: Spacing.one,
  },
  fanCover: {
    position: 'absolute',
    width: 86,
    height: 129,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  intro: {
    gap: Spacing.three,
  },
  form: {
    gap: Spacing.four,
  },
  nameRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  nameCell: {
    flex: 1,
  },
  field: {
    gap: Spacing.two,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    height: 50,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: Spacing.four,
  },
  input: {
    flex: 1,
    height: '100%',
    minWidth: 0,
    fontFamily: Fonts.sans,
    fontSize: 16,
  },
  remember: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.one,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: {
    borderRadius: Radius.md,
    padding: Spacing.three,
  },
  switch: {
    alignSelf: 'center',
    paddingVertical: Spacing.two,
  },
  underline: {
    textDecorationLine: 'underline',
  },
});
