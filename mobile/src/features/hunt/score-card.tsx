import { useEffect, type ReactNode } from 'react';
import { StyleSheet, useColorScheme, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  Keyframe,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { CountUp } from '@/components/celebration';
import { LinkIcon } from '@/components/hunt-icons';
import { ThemedText } from '@/components/themed-text';
import { Edge, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { success } from '@/lib/haptics';
import { ordinal } from '@/lib/format';

/*
 * The win moment, about 2.2s, played once. Every step animates opacity and transforms only, and every
 * element takes its final size from the first frame, so nothing around the card moves (no layout shift).
 * Under Reduce Motion the card simply appears in its final state.
 */
const T = {
  card: 150,
  title: 350,
  count: 450,
  countFor: 800,
  bump: 1250,
  rank: 1250,
  line: 1350,
  chip: 1550,
  chipShine: 1900,
  total: 1850,
  extra: 2000,
  cardShine: 2100,
};

const rm = ReduceMotion.System;
const pop = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: 24 }, { scale: 0.94 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }], easing: Easing.bezier(0.2, 0.9, 0.3, 1.25) },
})
  .delay(T.card)
  .duration(450)
  .reduceMotion(rm);
const up = (delay: number) =>
  new Keyframe({
    0: { opacity: 0, transform: [{ translateY: 8 }] },
    100: { opacity: 1, transform: [{ translateY: 0 }], easing: Easing.out(Easing.quad) },
  })
    .delay(delay)
    .duration(350)
    .reduceMotion(rm);
const fromRight = new Keyframe({
  0: { opacity: 0, transform: [{ translateX: 24 }] },
  100: { opacity: 1, transform: [{ translateX: 0 }], easing: Easing.bezier(0.2, 0.9, 0.3, 1.3) },
})
  .delay(T.rank)
  .duration(450)
  .reduceMotion(rm);
const draw = new Keyframe({
  0: { transform: [{ scaleX: 0 }] },
  100: { transform: [{ scaleX: 1 }], easing: Easing.out(Easing.quad) },
})
  .delay(T.line)
  .duration(350)
  .reduceMotion(rm);
const stamp = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 1.4 }, { rotate: '-10deg' }] },
  100: { opacity: 1, transform: [{ scale: 1 }, { rotate: '0deg' }], easing: Easing.bezier(0.3, 1.4, 0.5, 1) },
})
  .delay(T.chip)
  .duration(350)
  .reduceMotion(rm);

/** One soft white highlight that sweeps across its parent once (the parent clips it). */
function Shine({ delay, duration, band = 0.4 }: { delay: number; duration: number; band?: number }) {
  const reduced = useReducedMotion();
  // White light reads much stronger on the dark card, so it's dimmer there.
  const peak = useColorScheme() === 'dark' ? 0.22 : 0.55;
  const width = useSharedValue(0);
  const t = useSharedValue(0);

  useEffect(() => {
    if (!reduced) t.value = withDelay(delay, withTiming(1, { duration, easing: Easing.inOut(Easing.quad) }));
  }, [reduced, delay, duration, t]);

  const sweep = useAnimatedStyle(() => {
    const w = width.value * band;
    return {
      width: w,
      opacity: width.value > 0 && t.value > 0 && t.value < 1 ? 1 : 0,
      transform: [{ translateX: -w * 1.5 + t.value * (width.value + w * 2.5) }, { skewX: '-14deg' }],
    };
  });

  if (reduced) return null;
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      onLayout={(e: LayoutChangeEvent) => {
        width.value = e.nativeEvent.layout.width;
      }}>
      <Animated.View style={[styles.shine, sweep]}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="shine" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
              <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={peak} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#shine)" />
        </Svg>
      </Animated.View>
    </View>
  );
}

type Props = {
  title: string;
  points: number;
  comboPoints: number;
  /** Order this find arrived in today (1 = first finder); hidden when unknown. */
  rank: number | null;
  /** Shown under the card, after the total (e.g. "All 5 found today"). */
  footer?: ReactNode;
};

/** "Nice find!": points counting up, rank, combo bonus and total, choreographed as one short sequence. */
export function ScoreCard({ title, points, comboPoints, rank, footer }: Props) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const bump = useSharedValue(1);

  useEffect(() => {
    success();
    if (!reduced) {
      bump.value = withDelay(
        T.bump,
        withSequence(withTiming(1.08, { duration: 150 }), withTiming(1, { duration: 150, easing: Easing.out(Easing.quad) })),
      );
    }
  }, [reduced, bump]);

  const bumpStyle = useAnimatedStyle(() => ({ transform: [{ scale: bump.value }] }));
  const hasCombo = comboPoints > 0;

  return (
    <View style={styles.wrap}>
      <Animated.View
        entering={pop}
        style={[styles.card, { backgroundColor: theme.scoreFace, borderColor: theme.scoreEdge }]}>
        <View style={styles.top}>
          <View style={styles.pointsCol}>
            <Animated.View entering={up(T.title)}>
              <ThemedText type="subtitle" maxFontSizeMultiplier={1.3}>
                {title}
              </ThemedText>
            </Animated.View>
            <View style={styles.pointsRow}>
              <Animated.View style={[styles.counter, bumpStyle]}>
                {/* The final number holds the width, so "pts" never slides while the count runs. */}
                <ThemedText style={[styles.points, styles.hidden]} maxFontSizeMultiplier={1.2} importantForAccessibility="no" accessibilityElementsHidden>
                  +{points}
                </ThemedText>
                <CountUp
                  value={points}
                  prefix="+"
                  delay={T.count}
                  duration={T.countFor}
                  maxFontSizeMultiplier={1.2}
                  style={[styles.points, styles.counting, { color: theme.successText }]}
                />
              </Animated.View>
              <ThemedText type="subtitle" style={{ color: theme.successText }} maxFontSizeMultiplier={1.3}>
                pts
              </ThemedText>
            </View>
          </View>
          {rank ? (
            <Animated.View entering={fromRight} style={styles.rank}>
              <ThemedText type="subtitle" style={[styles.tabular, { color: theme.scoreNumber }]} maxFontSizeMultiplier={1.3}>
                {ordinal(rank)}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} maxFontSizeMultiplier={1.3}>
                to find it today
              </ThemedText>
            </Animated.View>
          ) : null}
        </View>

        {hasCombo ? (
          <>
            <Animated.View entering={draw} style={[styles.line, { backgroundColor: theme.scoreDivider }]} />
            <View style={styles.bottom}>
              <Animated.View
                entering={stamp}
                accessible
                accessibilityLabel={`Combo! Plus ${comboPoints} bonus points for linking neighbouring words`}
                style={[styles.chip, { backgroundColor: theme.tint, borderColor: theme.tintEdge }]}>
                <LinkIcon size={16} />
                <ThemedText type="smallBold" style={{ color: theme.onTint }} maxFontSizeMultiplier={1.3}>
                  Combo +{comboPoints}
                </ThemedText>
                <Shine delay={T.chipShine} duration={500} band={0.6} />
              </Animated.View>
              <Animated.View entering={up(T.total)} style={styles.totalWrap}>
                <ThemedText style={[styles.total, styles.tabular]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                  Total +{points + comboPoints} pts
                </ThemedText>
              </Animated.View>
            </View>
          </>
        ) : null}
        <Shine delay={T.cardShine} duration={800} />
      </Animated.View>
      {footer ? <Animated.View entering={up(T.extra)}>{footer}</Animated.View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: 8,
  },
  card: {
    alignSelf: 'stretch',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: Radius.lg,
    borderWidth: 2,
    borderBottomWidth: Edge.card,
    gap: 10,
    overflow: 'hidden',
  },
  top: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  pointsCol: {
    flexShrink: 1,
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    // Room for the 8% bump so the number never touches "pts".
    gap: 8,
  },
  counter: {
    transformOrigin: 'left bottom',
  },
  points: {
    fontSize: 48,
    lineHeight: 52,
    fontWeight: 900,
    fontVariant: ['tabular-nums'],
  },
  hidden: {
    opacity: 0,
  },
  counting: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  rank: {
    flexShrink: 0,
    alignItems: 'center',
    paddingBottom: 6,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  line: {
    height: 2,
    transformOrigin: 'left center',
  },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 2,
    borderBottomWidth: 4,
    overflow: 'hidden',
  },
  totalWrap: {
    flexShrink: 1,
  },
  total: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: 900,
  },
  shine: {
    position: 'absolute',
    top: '-30%',
    bottom: '-30%',
    left: 0,
  },
});
