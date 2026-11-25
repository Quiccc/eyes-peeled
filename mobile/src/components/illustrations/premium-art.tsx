import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Path } from 'react-native-svg';

import { GOLD, INK, IRIS, LID, SHADOW } from '@/components/illustrations/art-kit';
import { useTheme } from '@/hooks/use-theme';

/**
 * Premium and Profile artwork, drawn in the logo's style (ink outline, white fills, iris blue, gold).
 * Paths match the "Word Hunt Redesign" canvas (Profile & Premium page) one to one.
 */

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const WHITE = '#FFFFFF';
const RED = '#F0524F';
const PURPLE = '#9B5DE5';
const SPARKLE = 'M0 -7l1.8 5.2L7 0l-5.2 1.8L0 7l-1.8-5.2L-7 0l5.2-1.8z';

/** Loops 0→1→0 forever after `delay` ms (stays at 0 under Reduce Motion). */
function useLoop(duration: number, delay = 0): SharedValue<number> {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => cancelAnimation(t);
  }, [delay, duration, reduced, t]);
  return t;
}

/** A gold sparkle centred on (x, y) at `scale`, twinkling `delay` ms out of step with its neighbours. Full colour when still. */
function Twinkle({ x, y, scale = 1, delay = 0 }: { x: number; y: number; scale?: number; delay?: number }) {
  const t = useLoop(900, delay);
  const props = useAnimatedProps(() => ({ opacity: 1 - 0.45 * t.value }));
  return (
    <AnimatedG animatedProps={props}>
      <Path d={SPARKLE} transform={`translate(${x} ${y}) scale(${scale})`} fill={GOLD} strokeWidth={1.6 / scale} />
    </AnimatedG>
  );
}

function Picture({ label, width, height, children }: { label: string; width: number; height: number; children: ReactNode }) {
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ width, height }}>
      {children}
    </View>
  );
}

/* ---------- The crowned eyeball (80×80 grid) ---------- */

/** The mascot in a gold crown. `plate`: a soft circle behind it (the Premium member card). */
function CrownedEye({ size, plate }: { size: number; plate?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 80 80" fill="none" stroke={INK} strokeLinecap="round" strokeLinejoin="round">
      {plate ? (
        <>
          <Circle cx={40} cy={44} r={34} fill={plate} stroke="none" />
          <Circle cx={40} cy={48} r={22} fill={WHITE} strokeWidth={4} />
          <Circle cx={44} cy={45} r={10} fill={IRIS} strokeWidth={3} />
          <Circle cx={44} cy={45} r={4.5} fill={INK} stroke="none" />
          <G transform="rotate(-12 40 22)">
            <Path d="M28 27l1.5-12 6.5 6 4-8.5 4 8.5 6.5-6L52 27z" fill={GOLD} strokeWidth={3.4} />
          </G>
        </>
      ) : (
        <>
          <Circle cx={42} cy={50} r={24} fill={SHADOW} stroke="none" />
          <Circle cx={40} cy={46} r={24} fill={WHITE} strokeWidth={4} />
          <Circle cx={45} cy={42} r={11} fill={IRIS} strokeWidth={3} />
          <Circle cx={45} cy={42} r={5} fill={INK} stroke="none" />
          <Circle cx={41.5} cy={38.5} r={2.5} fill={WHITE} stroke="none" />
          <G transform="rotate(-12 40 18)">
            <Path d="M27 24l1.5-13 7 6.5L40 8l4.5 9.5 7-6.5L53 24z" fill={GOLD} strokeWidth={3} />
            <Circle cx={40} cy={20} r={2} fill={RED} strokeWidth={1.5} />
          </G>
          <Path d={SPARKLE} transform="translate(12 14) scale(0.9)" fill={WHITE} strokeWidth={1.7} />
        </>
      )}
    </Svg>
  );
}

/** The upsell card's mascot, peeking up from the card's bottom-right corner. Decorative. */
export function UpsellMascot({ size = 96 }: { size?: number }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <CrownedEye size={size} />
    </View>
  );
}

/** The Premium member card's badge: the crowned eye on a soft purple plate. Decorative. */
export function MemberBadge({ size = 48 }: { size?: number }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <CrownedEye size={size} plate="#EDE2FB" />
    </View>
  );
}

/* ---------- Premium screen hero (140×112) ---------- */

export function PremiumHeroArt() {
  const theme = useTheme();
  return (
    <Picture label="The eyeball mascot wearing a gold crown" width={140} height={112}>
      <Svg width={140} height={112} viewBox="0 0 140 112" fill="none" stroke={INK} strokeLinecap="round" strokeLinejoin="round">
        <Circle cx={70} cy={58} r={52} fill={theme.backgroundSelected} stroke="none" />
        <Circle cx={72} cy={72} r={28} fill={SHADOW} stroke="none" />
        <Circle cx={70} cy={68} r={28} fill={WHITE} strokeWidth={4} />
        <Circle cx={75} cy={64} r={12.5} fill={IRIS} strokeWidth={3} />
        <Circle cx={75} cy={64} r={6} fill={INK} stroke="none" />
        <Circle cx={71} cy={60} r={2.8} fill={WHITE} stroke="none" />
        <G transform="rotate(-10 70 34)">
          <Path d="M54 40l2-16 9 8 5-11 5 11 9-8 2 16z" fill={GOLD} strokeWidth={3.4} />
          <Circle cx={70} cy={35} r={2.4} fill={RED} strokeWidth={1.6} />
        </G>
        <Twinkle x={26} y={32} />
        <Twinkle x={116} y={44} scale={0.75} delay={300} />
        <Twinkle x={112} y={90} scale={0.6} delay={600} />
      </Svg>
    </Picture>
  );
}

/* ---------- Welcome to Premium (220×180 grid) ---------- */

const WELCOME_W = 220;
const WELCOME_H = 180;

/** Right after buying: the crowned mascot pops in, beaming, under orange rays and twinkling sparkles. */
export function PremiumWelcomeArt({ width = 240 }: { width?: number }) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const height = (WELCOME_H / WELCOME_W) * width;
  const pop = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) return;
    pop.value = withDelay(120, withSpring(1, { damping: 9, stiffness: 160 }));
  }, [pop, reduced]);

  const popStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, pop.value * 2),
    transform: [{ scale: 0.4 + 0.6 * pop.value }],
  }));

  const box = { width, height };
  return (
    <Picture label="The eyeball mascot, now wearing a gold crown, beaming" width={width} height={height}>
      <Svg {...box} viewBox={`0 0 ${WELCOME_W} ${WELCOME_H}`} fill="none" stroke={INK} strokeLinecap="round" style={StyleSheet.absoluteFill}>
        <Circle cx={110} cy={98} r={78} fill={theme.backgroundSelected} stroke="none" />
        <Path d="M110 6v12M42 34l8 8M178 34l-8 8M22 98h12M186 98h12" stroke="#FF8A00" strokeWidth={5} />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: '50% 60%' }, popStyle]}>
        <Svg {...box} viewBox={`0 0 ${WELCOME_W} ${WELCOME_H}`} fill="none" stroke={INK} strokeLinecap="round" strokeLinejoin="round">
          <Circle cx={113} cy={110} r={42} fill={SHADOW} stroke="none" />
          <Circle cx={110} cy={104} r={42} fill={WHITE} strokeWidth={5} />
          <Circle cx={114} cy={96} r={17} fill={IRIS} strokeWidth={3.5} />
          <Circle cx={114} cy={96} r={8} fill={INK} stroke="none" />
          <Circle cx={109} cy={91} r={3.5} fill={WHITE} stroke="none" />
          <Path d="M70.6 116Q110 96 149.4 116A42 42 0 0 1 70.6 116z" fill={LID} strokeWidth={3.5} />
          <G transform="rotate(-10 110 58)">
            <Path d="M84 66l3-26 14 12 9-18 9 18 14-12 3 26z" fill={GOLD} strokeWidth={4} />
            <Circle cx={110} cy={58} r={3.5} fill={RED} strokeWidth={2} />
            <Circle cx={94} cy={60} r={2.4} fill={IRIS} strokeWidth={1.6} />
            <Circle cx={126} cy={60} r={2.4} fill="#2FB344" strokeWidth={1.6} />
          </G>
        </Svg>
      </Animated.View>
      <Svg {...box} viewBox={`0 0 ${WELCOME_W} ${WELCOME_H}`} fill="none" stroke={INK} strokeLinejoin="round" style={StyleSheet.absoluteFill}>
        <Twinkle x={44} y={70} scale={1.4} />
        <Twinkle x={178} y={74} delay={300} />
        <Twinkle x={172} y={150} scale={0.8} delay={600} />
        <Twinkle x={50} y={146} scale={0.7} delay={450} />
      </Svg>
    </Picture>
  );
}

/* ---------- Benefit glyphs (24 grid, on fixed pastel tiles) ---------- */

export const BENEFIT_TILE = {
  noAds: '#DCEFFB',
  premiumWord: '#EDE2FB',
  payOnce: '#FFF1DC',
} as const;

function Glyph({ size = 30, children }: { size?: number; children: ReactNode }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={INK}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {children}
    </Svg>
  );
}

/** "No ads": a crossed-out megaphone. */
export function NoAdsGlyph() {
  return (
    <Glyph>
      <Path d="M3.5 9.5v5h3l8 4.5v-14l-8 4.5z" fill={WHITE} />
      <Path d="M17.5 9.5q1.6 2.5 0 5" />
      <Path d="M4 4l16 16" strokeWidth={4.4} />
      <Path d="M4 4l16 16" stroke={RED} strokeWidth={2.2} />
    </Glyph>
  );
}

/** "Daily Premium word": a purple word card with a gold star. */
export function PremiumWordGlyph() {
  return (
    <Glyph>
      <Path d="M6 3.5h12a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 19V5A1.5 1.5 0 0 1 6 3.5z" fill={PURPLE} />
      <Path d="M12 7l1.5 3.1 3.4.5-2.5 2.4.6 3.4-3-1.6-3 1.6.6-3.4-2.5-2.4 3.4-.5z" fill={GOLD} strokeWidth={1.5} />
    </Glyph>
  );
}

/** "Pay once": a gold "1" coin. */
export function PayOnceGlyph() {
  return (
    <Glyph>
      <Circle cx={12} cy={12} r={8.5} fill={GOLD} />
      <Circle cx={12} cy={12} r={6} strokeWidth={1.4} />
      <Path d="M10.5 9.5l2-1.5v8" strokeWidth={2.2} />
    </Glyph>
  );
}

/* ---------- Profile: no finds yet (68×70 crop of an 128 grid) ---------- */

const SLEEPY_BOX = { x: 32, y: 26, w: 68, h: 70 };
/** Lid bottom edge: open (resting, drowsy) and fully closed (blink). */
const LID_OPEN = 56;
const LID_CLOSED = 92;
const CYCLE = 5000;

/**
 * "No finds yet today": the sleepy eyeball floats, looks around (left, right, back) and blinks once a cycle.
 * Still under Reduce Motion.
 */
export function SleepyEyeArt({ size = 96 }: { size?: number }) {
  const reduced = useReducedMotion();
  const bob = useLoop(1600);
  const cycle = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    cycle.value = withRepeat(withTiming(1, { duration: CYCLE, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(cycle);
  }, [cycle, reduced]);

  const float = useAnimatedStyle(() => ({ transform: [{ translateY: (-5 * bob.value * size) / SLEEPY_BOX.w }] }));
  // Look left (30–45%), right (62–78%), back to centre; ease between holds.
  const look = (c: number) => {
    'worklet';
    return {
      dx: interpolate(c, [0, 0.12, 0.3, 0.45, 0.62, 0.78, 1], [0, 0, -9, -9, 5, 5, 0]),
      dy: interpolate(c, [0, 0.12, 0.3, 0.45, 0.62, 0.78, 1], [0, 0, 1, 1, 2, 2, 0]),
    };
  };
  const iris = useAnimatedProps(() => {
    const { dx, dy } = look(cycle.value);
    return { cx: 70 + dx, cy: 64 + dy };
  });
  const pupil = useAnimatedProps(() => {
    const { dx, dy } = look(cycle.value);
    return { cx: 70 + dx, cy: 64 + dy };
  });
  const glint = useAnimatedProps(() => {
    const { dx, dy } = look(cycle.value);
    return { cx: 66.5 + dx, cy: 60.5 + dy };
  });
  const lidEdge = (c: number) => {
    'worklet';
    return interpolate(c, [0, 0.4, 0.46, 0.52, 1], [LID_OPEN, LID_OPEN, LID_CLOSED, LID_OPEN, LID_OPEN]);
  };
  const lid = useAnimatedProps(() => {
    const y = lidEdge(cycle.value);
    return { d: `M30 30H98V${y}Q64 ${y + 8} 30 ${y}z` };
  });
  const lidLine = useAnimatedProps(() => {
    const y = lidEdge(cycle.value);
    return { d: `M36 ${y - 0.5}Q64 ${y + 8} 92 ${y - 0.5}` };
  });

  const height = (SLEEPY_BOX.h / SLEEPY_BOX.w) * size;
  const viewBox = `${SLEEPY_BOX.x} ${SLEEPY_BOX.y} ${SLEEPY_BOX.w} ${SLEEPY_BOX.h}`;
  return (
    <Picture label="The eyeball mascot, sleepy, looking around for a find" width={size} height={height}>
      <Svg width={size} height={height} viewBox={viewBox} style={StyleSheet.absoluteFill}>
        <Ellipse cx={65} cy={92} rx={18} ry={3} fill="rgba(43,33,24,0.18)" />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, float]}>
        <Svg width={size} height={height} viewBox={viewBox} fill="none" stroke={INK} strokeLinecap="round" strokeLinejoin="round">
          <Defs>
            <ClipPath id="sleepy-eye">
              <Circle cx={64} cy={62} r={25} />
            </ClipPath>
          </Defs>
          <Circle cx={64} cy={62} r={26} fill={WHITE} stroke="none" />
          <G clipPath="url(#sleepy-eye)">
            <AnimatedCircle cx={70} cy={64} r={11} fill={IRIS} strokeWidth={3} animatedProps={iris} />
            <AnimatedCircle cx={70} cy={64} r={5} fill={INK} stroke="none" animatedProps={pupil} />
            <AnimatedCircle cx={66.5} cy={60.5} r={2.2} fill={WHITE} stroke="none" animatedProps={glint} />
            <AnimatedPath d={`M30 30H98V${LID_OPEN}Q64 ${LID_OPEN + 8} 30 ${LID_OPEN}z`} fill={LID} stroke="none" animatedProps={lid} />
            <AnimatedPath d={`M36 ${LID_OPEN - 0.5}Q64 ${LID_OPEN + 8} 92 ${LID_OPEN - 0.5}`} strokeWidth={3} animatedProps={lidLine} />
          </G>
          <Circle cx={64} cy={62} r={26} strokeWidth={4} />
        </Svg>
      </Animated.View>
    </Picture>
  );
}
