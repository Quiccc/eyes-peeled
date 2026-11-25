import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Logo art is drawn on a 120×120 grid (from the design canvas's Logo artboard). */
const VIEWBOX = 120;
const INK = '#2B2118';
/** The icon's orange sunburst: the base color and the lighter rays. */
export const SUNBURST = { base: '#FF8A00', ray: '#FFA733' } as const;
const RAYS =
  'M60 60L160 60L152.4 98.3ZM60 60L130.7 130.7L98.3 152.4ZM60 60L60 160L21.7 152.4ZM60 60L-10.7 130.7L-32.4 98.3ZM60 60L-40 60L-32.4 21.7ZM60 60L-10.7 -10.7L21.7 -32.4ZM60 60L60 -40L98.3 -32.4ZM60 60L130.7 -10.7L152.4 21.7Z';

/**
 * Where the iris glances, as offsets from where it rests. Every stop keeps the iris inside the eye's
 * outline and above the grin. Each glance is a quick move followed by a hold.
 */
const GLANCES = [
  { x: -18, y: 2, hold: 1200 }, // left
  { x: 2, y: -5, hold: 1100 }, // up and right
  { x: 6, y: 2, hold: 1100 }, // right
  { x: 0, y: 0, hold: 1200 }, // back to rest
];
const EDGE = 8;
const MOVE_MS = 180;
const FIRST_LOOK_MS = 2000;

type Props = {
  size?: number;
  /** Height of the darker bottom edge in px; scale it down with the logo (e.g. 3 at 40px). */
  edge?: number;
  /** Set false for a still logo (Reduce Motion always makes it still). */
  animated?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** The Eyes Peeled eyeball mascot. When animated, the eye looks around every few seconds. */
export function EyesPeeledLogo({ size = 128, edge = EDGE, animated = true, style }: Props) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const moving = animated && !reduced;

  useEffect(() => {
    if (!moving) {
      dx.value = 0;
      dy.value = 0;
      return;
    }
    const ease = Easing.bezier(0.3, 0, 0.2, 1);
    const path = (axis: 'x' | 'y') =>
      withDelay(
        FIRST_LOOK_MS,
        withRepeat(
          withSequence(
            ...GLANCES.flatMap((g) => [
              withTiming(g[axis], { duration: MOVE_MS, easing: ease }),
              withTiming(g[axis], { duration: g.hold }),
            ]),
          ),
          -1,
        ),
      );
    dx.value = path('x');
    dy.value = path('y');
    return () => {
      cancelAnimation(dx);
      cancelAnimation(dy);
    };
  }, [moving, dx, dy]);

  const radius = (28 / VIEWBOX) * size;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Eyes Peeled"
      style={[
        styles.badge,
        // A darker tile peeking out below gives the chunky bottom edge.
        { width: size, height: size + edge, borderRadius: radius, backgroundColor: theme.tintEdge },
        style,
      ]}>
      <Svg width={size} height={size} viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}>
        <Defs>
          <ClipPath id="eyesPeeledLogoClip">
            <Rect width={VIEWBOX} height={VIEWBOX} rx={28} />
          </ClipPath>
        </Defs>
        <G clipPath="url(#eyesPeeledLogoClip)">
          <Rect width={VIEWBOX} height={VIEWBOX} fill={SUNBURST.base} />
          <Path d={RAYS} fill={SUNBURST.ray} />
        </G>
        <MascotArt dx={dx} dy={dy} />
      </Svg>
    </View>
  );
}

type MascotArtProps = { dx: SharedValue<number>; dy: SharedValue<number> };

/**
 * The eyeball mascot's shapes on the logo's 120×120 grid, without the orange tile. `dx`/`dy` shift the iris.
 * Place it inside an `Svg` (scale it with a `G` transform).
 */
export function MascotArt({ dx, dy }: MascotArtProps) {
  return (
    <G>
      <Circle cx={63} cy={75} r={36} fill="#B35500" />
      <Circle cx={60} cy={68} r={36} fill="#FFFFFF" stroke={INK} strokeWidth={6} />
      <IrisCircle dx={dx} dy={dy} cx={66} cy={62} r={17} fill="#2D9CDB" stroke={INK} strokeWidth={4} />
      <IrisCircle dx={dx} dy={dy} cx={66} cy={62} r={8} fill={INK} />
      <IrisCircle dx={dx} dy={dy} cx={61} cy={57} r={4} fill="#FFFFFF" />
      <Path d="M44 84Q62 98 80 84" fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round" />
      <Path d="M36 28Q54 14 72 22" fill="none" stroke={INK} strokeWidth={7} strokeLinecap="round" />
      <Path
        d="M98 14l3 8 8 3-8 3-3 8-3-8-8-3 8-3z"
        fill="#FFC83D"
        stroke={INK}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
    </G>
  );
}

type IrisCircleProps = {
  dx: SharedValue<number>;
  dy: SharedValue<number>;
  cx: number;
  cy: number;
  r: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
};

/** One circle of the iris group; all three share the same offset, so they move together. */
function IrisCircle({ dx, dy, cx, cy, ...rest }: IrisCircleProps) {
  const animatedProps = useAnimatedProps(() => ({ cx: cx + dx.value, cy: cy + dy.value }));
  return <AnimatedCircle animatedProps={animatedProps} cx={cx} cy={cy} {...rest} />;
}

const styles = StyleSheet.create({
  badge: {
    transform: [{ rotate: '-6deg' }],
  },
});
