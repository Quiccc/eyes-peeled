import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, G, Path, Rect, Text as SvgText } from 'react-native-svg';

import { GOLD, INK, IRIS, LID, SHADOW } from '@/components/illustrations/art-kit';
import { FontFamily } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Hunt flow artwork, drawn in the logo's style (ink outline, white fills, iris blue, gold).
 * Paths match the "Word Hunt Redesign" canvas (Hunt & camera page) one to one.
 */

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const GLOVE_UNDERSIDE = '#EADCC8';
const GLOVE_EDGE = '#D9C7AE';
const CUFF = '#FF8A00';
const SPARKLE_PATH = 'M0 -7l1.8 5.2L7 0l-5.2 1.8L0 7l-1.8-5.2L-7 0l5.2-1.8z';

/** The glove's outline: back of the hand plus four staggered fingers, in hand space (wrist at 8,24). */
const HAND =
  'M12 14.5Q22 9 34 10.8L60 12Q66 12.3 66.5 15.5Q66.6 17.8 63 18.1L65 18.1Q70.5 18.5 70.5 21Q70.3 24 66.5 24.1' +
  'L64 24.1Q67.5 24.4 67.3 27Q67 29.6 63.5 29.6L58 29.5Q61 29.8 60.8 32Q60.4 34.2 57 34.2L40 34.6Q26 35.6 12 33.6z';
const THUMB = 'M21 29Q17.5 37 24.5 41Q33 44.5 41 40.6Q44 38.2 40.4 36.2Q33 37.4 28.6 31z';
/** Places the hand on the brow: smaller, tilted up toward the gaze. */
const HAND_AT = 'translate(16 30) rotate(-22) scale(0.72) translate(-8 -24)';
const HAND_SHADOW_AT = 'translate(18 39) rotate(-22) scale(0.72) translate(-8 -24)';

/** A white cartoon glove with an orange cuff, in hand space. */
function Glove() {
  return (
    <G>
      <Path d={HAND} transform="translate(0 4.5)" fill={GLOVE_EDGE} strokeWidth={3.2} />
      <G transform="rotate(22 24 31)">
        <Path d={THUMB} fill="#FFFFFF" strokeWidth={3} />
        <Path d="M18 38L42 38L42 46L18 46z" clipPath="url(#lookout-thumb)" fill={GLOVE_UNDERSIDE} stroke="none" />
        <Path d="M31.5 37.6q1.5 1.8.6 3.8" fill="none" strokeWidth={1.5} />
      </G>
      <Path d={HAND} fill="#FFFFFF" stroke="none" />
      <G clipPath="url(#lookout-hand)" stroke="none" fill={GLOVE_UNDERSIDE}>
        <Path d="M8 31L72 27.5L72 40L8 40z" />
        <Path d="M44 16.6Q55 17.6 70 16.4L70 18.2L44 18.2z" />
        <Path d="M44 22.6Q56 23.4 72 22.4L72 24.4L44 24.4z" />
      </G>
      <Path
        d="M62.6 18.1Q52 18.5 43.5 17.3M64.2 24.1Q54 24.3 44 23.6M58.2 29.5Q51 29.9 45.5 29.4"
        fill="none"
        strokeWidth={2}
      />
      <Path
        d="M51 12.8q1.3 2.4.2 4.6M56.5 18.9q1.3 2.3.2 4.5M54 24.8q1.2 2.1.2 4.1M49.5 30.1q1 1.8.1 3.6"
        fill="none"
        strokeWidth={1.5}
      />
      <Path d={HAND} fill="none" strokeWidth={3.2} />
      <Path d="M4 15.2Q1.8 24 4 32.8Q8.5 36.2 13.6 34.3Q11.6 24 13.6 13.9Q8.5 11.8 4 15.2z" fill={CUFF} strokeWidth={3} />
      <Path d="M8.6 15.4Q6.8 24 8.6 32.6" fill="none" strokeWidth={1.5} strokeDasharray="2 2.6" />
    </G>
  );
}

const LOOKOUT_W = 104;
const LOOKOUT_H = 80;

/**
 * "Checking your photo": the eyeball mascot shading its eye with a gloved hand, looking far ahead at a
 * sparkle. It sways gently, its eye drifts and the sparkle twinkles; all still under Reduce Motion.
 */
export function LookoutMascot({ width = 120 }: { width?: number }) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const scale = width / LOOKOUT_W;
  const height = LOOKOUT_H * scale;
  const t = useSharedValue(0);
  const tw = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    t.value = withRepeat(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.sin) }), -1, true);
    tw.value = withRepeat(withTiming(1, { duration: 800, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => {
      cancelAnimation(t);
      cancelAnimation(tw);
    };
  }, [reduced, t, tw]);

  // Sway ±4° around the bottom of the ball; the eye drifts only ±2 so the gaze stays far ahead.
  const sway = useAnimatedStyle(() => ({ transform: [{ rotate: `${-4 + 8 * t.value}deg` }] }));
  const twinkle = useAnimatedStyle(() => ({ opacity: 1 - 0.4 * tw.value, transform: [{ scale: 1.1 - 0.4 * tw.value }] }));
  const iris = useAnimatedProps(() => ({ cx: 56 + 4 * t.value }));
  const pupil = useAnimatedProps(() => ({ cx: 58 + 4 * t.value }));
  const glint = useAnimatedProps(() => ({ cx: 54 + 4 * t.value }));

  return (
    <View
      style={{ width, height }}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Eyes Peeled mascot shading its eye and looking into the distance">
      <Svg width={width} height={height} viewBox={`0 0 ${LOOKOUT_W} ${LOOKOUT_H}`} style={StyleSheet.absoluteFill}>
        <Circle cx={42} cy={42} r={40} fill={theme.backgroundSelected} />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: `${(44 / LOOKOUT_W) * 100}% ${(74 / LOOKOUT_H) * 100}%` }, sway]}>
        <Svg
          width={width}
          height={height}
          viewBox={`0 0 ${LOOKOUT_W} ${LOOKOUT_H}`}
          stroke={INK}
          strokeLinecap="round"
          strokeLinejoin="round">
          <Defs>
            <ClipPath id="lookout-eye">
              <Circle cx={44} cy={46} r={26} />
            </ClipPath>
            <ClipPath id="lookout-thumb">
              <Path d={THUMB} />
            </ClipPath>
            <ClipPath id="lookout-hand">
              <Path d={HAND} />
            </ClipPath>
          </Defs>
          <Circle cx={46} cy={50} r={28} fill={SHADOW} stroke="none" />
          <Path d="M17 54Q4 50 12.9 42.4L13.9 32.4" fill="none" strokeWidth={4.5} />
          <Circle cx={44} cy={46} r={28} fill="#FFFFFF" strokeWidth={5} />
          <G clipPath="url(#lookout-eye)">
            <AnimatedCircle cy={46} r={12} fill={IRIS} strokeWidth={3.5} animatedProps={iris} />
            <AnimatedCircle cy={45} r={5.5} fill={INK} stroke="none" animatedProps={pupil} />
            <AnimatedCircle cy={42} r={2.6} fill="#FFFFFF" stroke="none" animatedProps={glint} />
            <Path d={HAND} transform={HAND_SHADOW_AT} fill="rgba(43,33,24,0.24)" stroke="none" />
          </G>
          <Circle cx={44} cy={46} r={28} fill="none" strokeWidth={5} />
          <G transform={HAND_AT}>
            <Glove />
          </G>
        </Svg>
      </Animated.View>
      <Animated.View
        style={[
          styles.sparkle,
          { left: (85 / LOOKOUT_W) * width, top: (13 / LOOKOUT_H) * height, width: 18 * scale, height: 18 * scale },
          twinkle,
        ]}>
        <Svg width={18 * scale} height={18 * scale} viewBox="85 13 18 18" stroke={INK} strokeLinejoin="round">
          <Path d="M94 13l2.3 6.7L103 22l-6.7 2.3L94 31l-2.3-6.7L85 22l6.7-2.3z" fill={GOLD} strokeWidth={2} />
        </Svg>
      </Animated.View>
    </View>
  );
}

/* ---------- Result badges: a 72×76 sticker on the photo card's corner ---------- */

export const BADGE_WIDTH = 72;
export const BADGE_HEIGHT = 76;

function Sticker({ face, edge, ring = '#FFFFFF', label, children }: { face: string; edge: string; ring?: string; label: string; children: React.ReactNode }) {
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ width: BADGE_WIDTH, height: BADGE_HEIGHT }}>
      <Svg width={BADGE_WIDTH} height={BADGE_HEIGHT} viewBox="0 0 72 76" stroke={INK} strokeLinecap="round" strokeLinejoin="round">
        <Circle cx={36} cy={40} r={33} fill={edge} stroke="none" />
        <Circle cx={36} cy={36} r={33} fill={face} stroke={ring} strokeWidth={3} />
        {children}
      </Svg>
    </View>
  );
}

/** A small mascot eye (r16) at (cx, cy); `inner` is drawn clipped to the ball. */
function BadgeEye({ id, cx, cy, children }: { id: string; cx: number; cy: number; children: React.ReactNode }) {
  return (
    <G>
      <Defs>
        <ClipPath id={id}>
          <Circle cx={cx} cy={cy} r={15} />
        </ClipPath>
      </Defs>
      <Circle cx={cx + 1.5} cy={cy + 2.5} r={16} fill={SHADOW} stroke="none" />
      <Circle cx={cx} cy={cy} r={16} fill="#FFFFFF" strokeWidth={3} />
      <G clipPath={`url(#${id})`}>{children}</G>
      <Circle cx={cx} cy={cy} r={16} fill="none" strokeWidth={3} />
    </G>
  );
}

function BadgeIris({ x, y }: { x: number; y: number }) {
  return (
    <G>
      <Circle cx={x} cy={y} r={7.5} fill={IRIS} strokeWidth={2.2} />
      <Circle cx={x} cy={y} r={3.5} fill={INK} stroke="none" />
      <Circle cx={x - 2} cy={y - 2} r={1.7} fill="#FFFFFF" stroke="none" />
    </G>
  );
}

function BadgeSparkle({ x, y, r }: { x: number; y: number; r: number }) {
  const k = r / 7;
  return <Path d={SPARKLE_PATH} transform={`translate(${x} ${y}) scale(${k})`} fill={GOLD} strokeWidth={1.5 / k} />;
}

/** Accepted: a happy eye and a gloved thumbs-up on green. */
export function ThumbsUpBadge() {
  const theme = useTheme();
  return (
    <Sticker face={theme.success} edge={theme.successEdge} label="Mascot giving a thumbs up">
      <BadgeEye id="badge-happy" cx={29} cy={39}>
        <BadgeIris x={31.5} y={35} />
        <Path d="M10 47Q29 35 48 47V62H10z" fill={LID} strokeWidth={2.6} />
      </BadgeEye>
      <G transform="rotate(-8 54 42)">
        <Rect x={46.5} y={49} width={15} height={6.5} rx={2.5} fill={CUFF} strokeWidth={2.4} />
        <Path d="M49.5 26.5Q49.5 22.5 53 22.5Q56.5 22.5 56.5 27V35" fill="#FFFFFF" strokeWidth={2.4} />
        <Rect x={45} y={33} width={19} height={17.5} rx={6} fill="#FFFFFF" strokeWidth={2.6} />
        <Path d="M49.5 26.5V35H56.5V27" fill="#FFFFFF" stroke="none" />
        <Path d="M49.5 26.8V34.5M56.5 27.2V34.5" fill="none" strokeWidth={2.4} />
        <Path d="M58 38.6h5M58 43h5M58 47.2h4.5" fill="none" strokeWidth={1.6} />
      </G>
    </Sticker>
  );
}

/** Rejected: a squinting, sideways glance under a "?" bubble, on red. */
export function PuzzledBadge() {
  const theme = useTheme();
  return (
    <Sticker face={theme.hard} edge={theme.hardEdge} label="Mascot squinting, puzzled">
      <BadgeEye id="badge-puzzled" cx={38} cy={41}>
        <BadgeIris x={32} y={42} />
        <Path d="M10 18H50V36Q34 42 10 34z" fill={LID} strokeWidth={2.6} />
      </BadgeEye>
      <Path
        d="M11 6.5H25Q29 6.5 29 10.5V18Q29 22 25 22H20L15.5 26V22H11Q7 22 7 18V10.5Q7 6.5 11 6.5z"
        fill="#FFFFFF"
        strokeWidth={2.4}
      />
      <SvgText x={18} y={19.6} textAnchor="middle" fontFamily={FontFamily} fontSize={14} fontWeight="900" fill={INK} stroke="none">
        ?
      </SvgText>
    </Sticker>
  );
}

/** Upload failed: a dizzy eye under a cracked cloud, on a neutral card colour (not "your photo was wrong"). */
export function DizzyBadge() {
  const theme = useTheme();
  return (
    <Sticker face={theme.backgroundElement} edge={theme.border} ring={theme.border} label="Mascot dizzy under a broken cloud">
      <BadgeEye id="badge-dizzy" cx={38} cy={44}>
        <Path
          d="M38 44a1.5 1.5 0 0 1 3 0a3 3 0 0 1-6 0a4.5 4.5 0 0 1 9 0a6 6 0 0 1-12 0a7.5 7.5 0 0 1 15 0"
          fill="none"
          strokeWidth={2.2}
        />
      </BadgeEye>
      <Path
        d="M19 26Q13 26 13.5 20.5Q14 16 19 16Q20.5 9 28 9.5Q34 10 35.5 15Q41 14.5 42 19.5Q43 26 37 26z"
        fill="#FFFFFF"
        strokeWidth={2.6}
      />
      <Path d="M30 12.5L26.5 18.5H31L27.5 24.5" fill="none" stroke="#F0524F" strokeWidth={2.2} />
      <BadgeSparkle x={57} y={28} r={4} />
      <BadgeSparkle x={57} y={52} r={3.2} />
    </Sticker>
  );
}

/* ---------- Full-size states (200×160 artwork) ---------- */

function Zz({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  return (
    <>
      <SvgText x={x1} y={y1} fontFamily={FontFamily} fontSize={22} fontWeight="900" fill={GOLD} strokeWidth={1.5}>
        z
      </SvgText>
      <SvgText x={x2} y={y2} fontFamily={FontFamily} fontSize={16} fontWeight="900" fill={GOLD} strokeWidth={1.2}>
        z
      </SvgText>
    </>
  );
}

/** Camera permission: a camera whose lens is the mascot's eye. `closed` = camera off (eye shut, asleep). */
export function CameraEyeArt({ closed = false, width = 220 }: { closed?: boolean; width?: number }) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={closed ? 'A camera with its eye closed' : 'A camera with the eyeball mascot as its lens'}>
      <Svg width={width} height={width * 0.8} viewBox="0 0 200 160" stroke={INK} strokeLinecap="round" strokeLinejoin="round">
        <Circle cx={100} cy={84} r={70} fill={theme.backgroundSelected} stroke="none" />
        <Rect x={70} y={34} width={36} height={22} rx={6} fill={theme.tint} strokeWidth={4} />
        <Rect x={46} y={54} width={112} height={78} rx={16} fill={SHADOW} stroke="none" />
        <Rect x={42} y={48} width={112} height={78} rx={16} fill="#FFFFFF" strokeWidth={5} />
        <Circle cx={136} cy={64} r={5} fill={GOLD} strokeWidth={3} />
        <Circle cx={98} cy={88} r={26} fill="#FFFFFF" strokeWidth={5} />
        {closed ? (
          <>
            <Path d="M72 88a26 26 0 0 1 52 0z" fill={LID} strokeWidth={4} />
            <Path d="M74 90q24 14 48 0M82 96l-4 6M98 100v7M114 96l4 6" fill="none" strokeWidth={4} />
            <Zz x1={150} y1={38} x2={166} y2={24} />
          </>
        ) : (
          <>
            <Circle cx={104} cy={83} r={12} fill={IRIS} strokeWidth={3.5} />
            <Circle cx={104} cy={83} r={5.5} fill={INK} stroke="none" />
            <Circle cx={100.5} cy={79.5} r={2.8} fill="#FFFFFF" stroke="none" />
            <Path d="M160 26l1.8 5.2L167 33l-5.2 1.8L160 40l-1.8-5.2L153 33l5.2-1.8z" fill={GOLD} strokeWidth={1.5} />
          </>
        )}
      </Svg>
    </View>
  );
}

/** The word isn't active anymore: a sleepy alarm clock. */
export function SleepyClockArt({ width = 220 }: { width?: number }) {
  const theme = useTheme();
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="A sleepy alarm clock">
      <Svg width={width} height={width * 0.8} viewBox="0 0 200 160" stroke={INK} strokeLinecap="round" strokeLinejoin="round">
        <Circle cx={100} cy={84} r={70} fill={theme.backgroundSelected} stroke="none" />
        <Path d="M70 128l-8 10M130 128l8 10" fill="none" strokeWidth={5} />
        <Circle cx={103} cy={88} r={46} fill={SHADOW} stroke="none" />
        <Circle cx={100} cy={84} r={46} fill="#FFFFFF" strokeWidth={5} />
        <Path d="M100 46v6M100 116v6M62 84h6M132 84h6" fill="none" strokeWidth={4} />
        <Path d="M100 84V60M100 84l16 10" fill="none" strokeWidth={5} />
        <Circle cx={100} cy={84} r={4} fill={INK} stroke="none" />
        <Path d="M78 34l-10-8M122 34l10-8" fill="none" strokeWidth={5} />
        <Zz x1={146} y1={44} x2={162} y2={30} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  sparkle: {
    position: 'absolute',
  },
});
