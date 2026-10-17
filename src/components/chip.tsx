import { StyleSheet } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { PressableScale } from './pressable-scale';
import { Text } from './text';

type Props = {
  label: string;
  count?: number;
  selected?: boolean;
  onPress?: () => void;
};

export function Chip({ label, count, selected = false, onPress }: Props) {
  const theme = useTheme();
  return (
    <PressableScale
      haptic
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.chip,
        selected
          ? { backgroundColor: theme.text, borderColor: theme.text }
          : { backgroundColor: 'transparent', borderColor: theme.border },
      ]}>
      <Text variant="label" tone={selected ? 'background' : 'textSecondary'}>
        {label}
      </Text>
      {count !== undefined && (
        <Text variant="mono" tone={selected ? 'background' : 'textTertiary'}>
          {count}
        </Text>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
});
