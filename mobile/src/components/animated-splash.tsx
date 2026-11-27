import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { G, Path } from 'react-native-svg';

import { MascotArt, SUNBURST } from '@/components/eyes-peeled-logo';

/** Matches app.json's expo-splash-screen `imageWidth`, so the native splash hands off without a jump. */
const MASCOT_SIZE = 160;
/** Keep the splash up at least this long, so the rays are seen turning rather than flashing by. */
const MIN_VISIBLE_MS = 1200;
const FADE_MS = 300;
const TURN_MS = 24000;
/** When the JS bundle started, which is about when the native splash hands over. */
const STARTED_AT = Date.now();

/** 8 light rays, 22.5° wide and 45° apart (like the app icon), on a circle of radius 1 around the origin. */
const RAYS = Array.from({ length: 8 }, (_, i) => {
  const a = (i * Math.PI) / 4;
  const b = a + Math.PI / 8;
  const p = (t: number) => `${Math.cos(t).toFixed(4)} ${Math.sin(t).toFixed(4)}`;
  return `M0 0L${p(a)}A1 1 0 0 1 ${p(b)}Z`;
}).join('');

type Props = {
  /** True once the app is ready to show its first screen. */
  ready: boolean;
  /** Called after the fade-out; unmount the splash then. */
  onDone: () => void;
};

/**
 * The launch screen: the app icon's orange sunburst, its rays slowly turning, with the eyeball mascot in the middle.
 * Takes over from the native splash (same color and mascot) and fades out once `ready`.
 * Under Reduce Motion the rays stay still and it disappears without a fade.
 */
export function AnimatedSplash({ ready, onDone }: Props) {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const turn = useSharedValue(0);
  const opacity = useSharedValue(1);
  // The mascot's iris stays put on the launch screen.
  const still = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    turn.value = withRepeat(withTiming(360, { duration: TURN_MS, easing: Easing.linear }), -1);
    return () => cancelAnimation(turn);
  }, [reduced, turn]);

  useEffect(() => {
    if (!ready) return;
    const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - STARTED_AT));
    const timer = setTimeout(() => {
      if (reduced) {
        onDone();
        return;
      }
      opacity.value = withTiming(0, { duration: FADE_MS }, (finished) => {
        if (finished) scheduleOnRN(onDone);
      });
    }, wait);
    return () => clearTimeout(timer);
  }, [ready, reduced, onDone, opacity]);

  const raysStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  // A square as wide as the screen's diagonal, so the turning rays always cover the corners.
  const side = Math.ceil(Math.hypot(width, height));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, fadeStyle]}
      pointerEvents={ready ? 'none' : 'auto'}
      accessibilityLabel={t('common.appLoading')}
      onLayout={() => void SplashScreen.hideAsync()}>
      <Animated.View
        style={[{ width: side, height: side, left: (width - side) / 2, top: (height - side) / 2 }, styles.rays, raysStyle]}>
        <Svg width={side} height={side} viewBox="-1 -1 2 2">
          <Path d={RAYS} fill={SUNBURST.ray} />
        </Svg>
      </Animated.View>
      <View style={styles.center} pointerEvents="none">
        {/* Same layout as assets/logo/splash.svg (the native splash image), so the handoff is seamless. */}
        <Svg width={MASCOT_SIZE} height={MASCOT_SIZE} viewBox="0 0 512 512">
          <G transform="translate(256 256) scale(4.3103) translate(-65 -62)">
            <MascotArt dx={still} dy={still} />
          </G>
        </Svg>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: SUNBURST.base,
    zIndex: 1000,
  },
  rays: {
    position: 'absolute',
  },
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
