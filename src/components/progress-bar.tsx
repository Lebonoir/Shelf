import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  /** 0 to 1. */
  value: number;
  height?: number;
};

export function ProgressBar({ value, height = 3 }: Props) {
  const theme = useTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.set(withSpring(Math.min(1, Math.max(0, value)), { stiffness: 120, damping: 20 }));
  }, [progress, value]);

  // scaleX keeps the animation on the compositor instead of re-laying out width.
  const fill = useAnimatedStyle(() => ({
    transform: [{ scaleX: progress.value }],
  }));

  return (
    <View style={[styles.track, { height, backgroundColor: theme.surfaceStrong }]}>
      <Animated.View
        style={[styles.fill, { backgroundColor: theme.accent, transformOrigin: 'left' }, fill]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  fill: {
    ...StyleSheet.absoluteFill,
    borderRadius: Radius.pill,
  },
});
