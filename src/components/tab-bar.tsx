import { router } from 'expo-router';
import type { Tabs } from 'expo-router/js-tabs';
import { Books, Compass, MagnifyingGlass, Scan, type IconProps } from 'phosphor-react-native';
import type { ComponentProps, ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { PressableScale } from './pressable-scale';
import { Text } from './text';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const TABS: Record<string, { label: string; Icon: ComponentType<IconProps> }> = {
  index: { label: 'Shelf', Icon: Books },
  discover: { label: 'Discover', Icon: Compass },
  search: { label: 'Search', Icon: MagnifyingGlass },
};

const TAB_WIDTH = 86;

/** A floating pill of tabs with a sliding ink indicator, plus a docked scan button. */
export function TabBar({ state, emitter, navigateToTab }: TabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const indicator = useAnimatedStyle(() => ({
    transform: [{ translateX: withSpring(state.index * TAB_WIDTH, { stiffness: 260, damping: 26 }) }],
  }));

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, Spacing.four) }]}>
      <View style={styles.dock}>
      <View
        style={[
          styles.bar,
          { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow },
        ]}>
        <Animated.View style={[styles.indicator, { backgroundColor: theme.text }, indicator]} />
        {state.routes.map((route, index) => {
          const tab = TABS[route.name];
          if (!tab) return null;
          const focused = state.index === index;
          const color = focused ? theme.background : theme.textSecondary;

          return (
            <PressableScale
              key={route.key}
              haptic
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={tab.label}
              style={styles.tab}
              onPress={() => {
                const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigateToTab(route.key);
              }}>
              {/* HIG tab bars: filled glyph for the selected tab, outline for the rest. */}
              <tab.Icon size={22} color={color} weight={focused ? 'fill' : 'regular'} />
              {/* Fixed-width pill: cap growth like the system tab bar does. */}
              <Text variant="caption" maxFontSizeMultiplier={1.2} style={{ color, fontFamily: Fonts.sansMedium, fontSize: 11, lineHeight: 13 }}>
                {tab.label}
              </Text>
            </PressableScale>
          );
        })}
      </View>
      <PressableScale
        haptic
        scaleTo={0.92}
        accessibilityRole="button"
        accessibilityLabel="Find a book from a photo"
        onPress={() => router.push('/find')}
        style={[styles.scan, { backgroundColor: theme.accent, shadowColor: theme.shadow }]}>
        <Scan size={22} color={theme.onAccent} weight="bold" />
      </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  dock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  scan: {
    width: 58,
    height: 58,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 8,
  },
  bar: {
    flexDirection: 'row',
    padding: 5,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 8,
  },
  indicator: {
    position: 'absolute',
    top: 5,
    left: 5,
    width: TAB_WIDTH,
    height: 48,
    borderRadius: Radius.pill,
  },
  tab: {
    width: TAB_WIDTH,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
});
