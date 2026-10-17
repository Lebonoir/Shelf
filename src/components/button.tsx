import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { PressableScale } from './pressable-scale';
import { Text } from './text';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  icon?: ReactNode;
  /** Put the icon after the label, e.g. a forward arrow. */
  iconAfter?: boolean;
  loading?: boolean;
  disabled?: boolean;
  grow?: boolean;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  iconAfter = false,
  loading = false,
  disabled = false,
  grow = false,
}: Props) {
  const theme = useTheme();
  const surfaces = {
    primary: { backgroundColor: theme.accent, borderColor: theme.accent },
    secondary: { backgroundColor: theme.surface, borderColor: theme.border },
    ghost: { backgroundColor: 'transparent', borderColor: theme.border },
  } as const;
  const tone = variant === 'primary' ? 'onAccent' : 'text';

  return (
    <PressableScale
      haptic
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={[
        styles.button,
        surfaces[variant],
        grow && styles.grow,
        (disabled || loading) && styles.disabled,
      ]}>
      {loading ? <ActivityIndicator size="small" color={theme[tone]} /> : !iconAfter && icon}
      <Text variant="label" tone={tone}>
        {label}
      </Text>
      {!loading && iconAfter && icon}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 48,
    paddingHorizontal: Spacing.five,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  grow: {
    flex: 1,
  },
  disabled: {
    opacity: 0.55,
  },
});
