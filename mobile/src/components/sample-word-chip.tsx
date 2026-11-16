import { useEffect } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import type { Difficulty } from '@/api/types';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Edge } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const STAGGER_MS = 100;
/** The float starts once the drop-in has settled. */
const FLOAT_START_MS = 600;
const sine = Easing.inOut(Easing.sin);

type Props = {
  word: string;
  hue: Difficulty;
  /** Resting tilt in degrees. */
  tilt: number;
  /** Position in the row: sets the drop-in delay and the float speed, so the cards drift out of sync. */
  index: number;
};

/**
 * A sample word card for the sign-in screen. It pops in after `index * 100ms`, then bobs and sways
 * gently. The 'expert' hue renders the Premium card: solid purple with a sweeping sheen and twinkling sparkles.
 * Under Reduce Motion it sits still in its resting pose.
 */
export function SampleWordChip({ word, hue, tilt, index }: Props) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const enter = useSharedValue(reduced ? 1 : 0);
  const float = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      enter.value = 1;
      float.value = 0;
      return;
    }
    const delay = index * STAGGER_MS;
    const half = 1300 + index * 200;
    enter.value = withDelay(delay, withSpring(1, { damping: 9, stiffness: 160 }));
    float.value = withDelay(
      delay + FLOAT_START_MS,
      withRepeat(
        withSequence(
          withTiming(1, { duration: half / 2, easing: sine }),
          withTiming(-1, { duration: half, easing: sine }),
          withTiming(0, { duration: half / 2, easing: sine }),
        ),
        -1,
      ),
    );
    return () => {
      cancelAnimation(enter);
      cancelAnimation(float);
    };
  }, [reduced, index, enter, float]);

  const motion = useAnimatedStyle(() => {
    const e = enter.value;
    const f = float.value;
    return {
      opacity: Math.min(1, Math.max(0, e * 2)),
      transform: [
        { translateY: -24 * (1 - e) - 3 * f },
        { rotate: `${tilt + 1.5 * f}deg` },
        { scale: 0.6 + 0.4 * e },
      ],
    };
  });

  if (hue === 'expert') {
    return (
      <Animated.View style={[styles.premiumWrap, motion]}>
        <PremiumFace word={word} />
        <Sparkle style={styles.sparkTopLeft} delay={0} />
        <Sparkle style={styles.sparkBottomRight} delay={800} />
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme[hue] }, motion]}>
      <ThemedText type="subtitle" style={styles.text}>
        {word}
      </ThemedText>
    </Animated.View>
  );
}

const SHEEN_WIDTH = 28;

function PremiumFace({ word }: { word: string }) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const width = useSharedValue(0);
  const sweep = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    // Sweep across in ~1.3s, then rest, every 3s.
    sweep.value = withDelay(
      1200,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1350, easing: Easing.inOut(Easing.quad) }),
          withDelay(1650, withTiming(0, { duration: 0 })),
        ),
        -1,
      ),
    );
    return () => cancelAnimation(sweep);
  }, [reduced, sweep]);

  const sheen = useAnimatedStyle(() => ({
    transform: [
      { translateX: -SHEEN_WIDTH * 2 + sweep.value * (width.value + SHEEN_WIDTH * 4) },
      { skewX: '-20deg' },
    ],
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    width.value = e.nativeEvent.layout.width;
  };

  return (
    <View
      onLayout={onLayout}
      style={[styles.card, styles.premium, { backgroundColor: theme.expert, borderColor: theme.expertEdge }]}>
      <ThemedText type="subtitle" style={[styles.text, { color: theme.onExpert }]}>
        {word}
      </ThemedText>
      {!reduced && <Animated.View pointerEvents="none" style={[styles.sheen, sheen]} />}
    </View>
  );
}

function Sparkle({ style, delay }: { style: StyleProp<ViewStyle>; delay: number }) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const p = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) {
      p.value = 1;
      return;
    }
    p.value = withDelay(
      delay,
      withRepeat(
        withSequence(withTiming(1, { duration: 800, easing: sine }), withTiming(0, { duration: 800, easing: sine })),
        -1,
      ),
    );
    return () => cancelAnimation(p);
  }, [reduced, delay, p]);

  const twinkle = useAnimatedStyle(() => ({
    opacity: 0.25 + 0.75 * p.value,
    transform: [{ scale: 0.6 + 0.5 * p.value }, { rotate: `${20 * p.value}deg` }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.spark, style, twinkle]}>
      <Icon name="star" size={16} color={theme.expert} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 2,
    borderBottomWidth: Edge.button,
  },
  premium: {
    overflow: 'hidden',
  },
  premiumWrap: {
    marginTop: 4,
  },
  text: {
    letterSpacing: 1,
  },
  sheen: {
    position: 'absolute',
    top: -10,
    bottom: -10,
    left: 0,
    width: SHEEN_WIDTH,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  spark: {
    position: 'absolute',
  },
  sparkTopLeft: {
    top: -10,
    left: -12,
  },
  sparkBottomRight: {
    bottom: -8,
    right: -12,
  },
});
