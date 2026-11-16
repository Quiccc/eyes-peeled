import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';

type Props = {
  /** Color of the moving arc, e.g. the word's difficulty color. */
  color: string;
  size?: number;
  accessibilityLabel?: string;
};

/** A ring on the soft track with a quarter arc going round: the "checking your photo" spinner. */
export function Spinner({ color, size = 44, accessibilityLabel = 'Loading' }: Props) {
  const theme = useTheme();
  const turn = useSharedValue(0);

  useEffect(() => {
    turn.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(turn);
  }, [turn]);

  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 360}deg` }] }));
  // The design's ring: 24px viewBox, r=9, 3px stroke → scaled to `size`.
  const stroke = (size * 3) / 24;
  const ring = { width: size * 0.75 + stroke, height: size * 0.75 + stroke, borderRadius: size, borderWidth: stroke };

  return (
    <View
      style={[styles.box, { width: size, height: size }]}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}>
      <View style={[styles.ring, ring, { borderColor: theme.backgroundSelected }]} />
      <Animated.View
        style={[
          styles.ring,
          ring,
          // One colored side = a quarter arc.
          { borderColor: 'transparent', borderTopColor: color },
          spin,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
  },
});
