import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * A loading placeholder exactly the size of its children: they lay out as normal but stay invisible, and a
 * soft pulsing block covers them. Wrap the real element with sample content (e.g. a "000" value) and the
 * screen keeps the same shape when the data arrives: no layout shift. Still under Reduce Motion.
 */
export function Bone({
  children,
  radius = Radius.sm / 2,
  style,
}: {
  children: ReactNode;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const pulse = usePulse();
  return (
    <View style={style} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.hidden}>{children}</View>
      <Animated.View
        style={[StyleSheet.absoluteFill, { borderRadius: radius, backgroundColor: theme.backgroundSelected }, pulse]}
      />
    </View>
  );
}

/** A fixed-size pulsing block, for placeholders with no real element to copy (a photo). */
export function Block({ style }: { style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const pulse = usePulse();
  return <Animated.View style={[{ backgroundColor: theme.backgroundSelected }, style, pulse]} />;
}

function usePulse() {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    t.value = withRepeat(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(t);
  }, [reduced, t]);
  return useAnimatedStyle(() => ({ opacity: 1 - 0.55 * t.value }));
}

const styles = StyleSheet.create({
  hidden: {
    opacity: 0,
  },
});
