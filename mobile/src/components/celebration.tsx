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

/**
 * Where each piece comes to rest, from the design (a 390×844 screen), turned into fractions of the screen.
 * size in px, rot in degrees, c = index into the confetti colors. Pieces drop in from above and stay.
 */
const BITS = [
  { x: 28, y: 96, size: 12, c: 0, rot: 18 },
  { x: 70, y: 150, size: 10, c: 2, rot: -24 },
  { x: 330, y: 110, size: 12, c: 4, rot: 30 },
  { x: 352, y: 190, size: 10, c: 1, rot: -12 },
  { x: 14, y: 300, size: 10, c: 3, rot: 40 },
  { x: 366, y: 330, size: 12, c: 0, rot: -30 },
  { x: 40, y: 470, size: 12, c: 1, rot: 14 },
  { x: 338, y: 480, size: 10, c: 3, rot: -40 },
  { x: 84, y: 520, size: 10, c: 4, rot: 60 },
  { x: 300, y: 536, size: 12, c: 2, rot: 20 },
  { x: 190, y: 470, size: 10, c: 0, rot: -16 },
  { x: 240, y: 76, size: 10, c: 1, rot: 48 },
].map((b, i) => ({ ...b, x: b.x / 390, y: b.y / 844, delay: (i % 6) * 0.04 }));

type BitSpec = (typeof BITS)[number];

function Bit({ t, bit, color }: { t: SharedValue<number>; bit: BitSpec; color: string }) {
  const style = useAnimatedStyle(() => {
    // Each piece starts a little after the last and settles in place, no fade-out.
    const p = Math.min(1, Math.max(0, (t.value - bit.delay) / (1 - bit.delay)));
    return {
      opacity: Math.min(1, p * 3),
      transform: [{ translateY: -160 * (1 - p) }, { rotate: `${bit.rot + 180 * (1 - p)}deg` }],
    };
  });
  return (
    <Animated.View
      style={[
        styles.bit,
        { left: `${bit.x * 100}%`, top: `${bit.y * 100}%`, width: bit.size, height: bit.size + 6, backgroundColor: color },
        style,
      ]}
    />
  );
}

/**
 * Confetti that drops in around the photo, plus a success haptic, for the moment a photo is accepted.
 * Lay it over the screen (it fills its parent and ignores touches). Under Reduce Motion the pieces just appear.
 */
export function Confetti() {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  const colors = [theme.tint, theme.easy, theme.medium, theme.hard, theme.expert];

  useEffect(() => {
    success();
    t.value = reduced ? 1 : withTiming(1, { duration: 900, easing: Easing.out(Easing.back(1.2)) });
  }, [reduced, t]);

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
    borderRadius: 3,
  },
});
