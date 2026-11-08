import * as Haptics from 'expo-haptics';
import { Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const SPRING = { stiffness: 320, damping: 22, mass: 0.6 };

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** How far the element sinks while pressed. */
  scaleTo?: number;
  haptic?: boolean;
};

/** A Pressable that physically gives under your finger. */
export function PressableScale({
  style,
  scaleTo = 0.97,
  haptic = false,
  // Everything pressable is announced as a button unless the caller says otherwise.
  accessibilityRole = 'button',
  onPressIn,
  onPressOut,
  onPress,
  ...props
}: Props) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      {...props}
      accessibilityRole={accessibilityRole}
      style={[style, animated]}
      onPressIn={(e) => {
        scale.set(withSpring(scaleTo, SPRING));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withSpring(1, SPRING));
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptic && Platform.OS !== 'web') Haptics.selectionAsync();
        onPress?.(e);
      }}
    />
  );
}
