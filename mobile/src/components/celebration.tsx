import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { ThemedText, type ThemedTextProps } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { success } from '@/lib/haptics';

/** x: horizontal start (0–1 of the width), dx: sideways drift in px, fall: distance in px, rot: final rotation. */
const BITS = [
  { x: 0.08, dx: -30, fall: 260, rot: 200, size: 12, c: 0 },
  { x: 0.18, dx: 24, fall: 340, rot: -160, size: 10, c: 1 },
  { x: 0.27, dx: -12, fall: 220, rot: 280, size: 12, c: 2 },
  { x: 0.36, dx: 30, fall: 380, rot: -220, size: 10, c: 3 },
  { x: 0.45, dx: -24, fall: 300, rot: 140, size: 12, c: 4 },
  { x: 0.54, dx: 16, fall: 240, rot: -300, size: 10, c: 0 },
  { x: 0.63, dx: -34, fall: 360, rot: 240, size: 12, c: 1 },
  { x: 0.72, dx: 22, fall: 280, rot: -180, size: 10, c: 2 },
  { x: 0.81, dx: -16, fall: 400, rot: 320, size: 12, c: 3 },
  { x: 0.9, dx: 28, fall: 250, rot: -260, size: 10, c: 4 },
  { x: 0.14, dx: 10, fall: 420, rot: 180, size: 10, c: 2 },
  { x: 0.5, dx: -8, fall: 440, rot: -140, size: 12, c: 3 },
  { x: 0.68, dx: 12, fall: 320, rot: 260, size: 10, c: 4 },
  { x: 0.86, dx: -22, fall: 300, rot: -200, size: 12, c: 0 },
] as const;

function Bit({ t, bit, color }: { t: SharedValue<number>; bit: (typeof BITS)[number]; color: string }) {
  const style = useAnimatedStyle(() => ({
    opacity: t.value < 0.75 ? 1 : (1 - t.value) * 4,
    transform: [
      { translateX: bit.dx * t.value },
      { translateY: -40 + bit.fall * t.value },
      { rotate: `${bit.rot * t.value}deg` },
    ],
  }));
  return (
    <Animated.View
      style={[
        styles.bit,
        { left: `${bit.x * 100}%`, width: bit.size, height: bit.size + 6, backgroundColor: color },
        style,
      ]}
    />
  );
}

/**
 * One confetti burst plus a success haptic, for the moment a photo is accepted.
 * Lay it over the screen (it fills its parent and ignores touches). Skipped under Reduce Motion.
 */
export function Confetti() {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  const colors = [theme.tint, theme.easy, theme.medium, theme.hard, theme.expert];

  useEffect(() => {
    success();
    if (!reduced) t.value = withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) });
  }, [reduced, t]);

  if (reduced) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" importantForAccessibility="no-hide-descendants">
      {BITS.map((bit, i) => (
        <Bit key={i} t={t} bit={bit} color={colors[bit.c]} />
      ))}
    </View>
  );
}

type CountUpProps = Omit<ThemedTextProps, 'children'> & { value: number; prefix?: string; suffix?: string };

/** Counts from 0 to `value` in about 0.7s. Shows the final value straight away under Reduce Motion. */
export function CountUp({ value, prefix = '', suffix = '', ...textProps }: CountUpProps) {
  const reduced = useReducedMotion();
  const [counted, setShown] = useState(0);
  const shown = reduced ? value : counted;

  useEffect(() => {
    if (reduced) return;
    const started = Date.now();
    let frame = 0;
    const tick = () => {
      const p = Math.min(1, (Date.now() - started) / 700);
      setShown(Math.round(value * (1 - (1 - p) * (1 - p))));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reduced]);

  return (
    <ThemedText accessibilityLabel={`${prefix}${value}${suffix}`} {...textProps}>
      {prefix}
      {shown}
      {suffix}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  bit: {
    position: 'absolute',
    top: 0,
    borderRadius: 3,
  },
});
