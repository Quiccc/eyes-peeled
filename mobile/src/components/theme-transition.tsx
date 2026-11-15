import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { captureScreen, releaseCapture } from 'react-native-view-shot';
import { scheduleOnRN } from 'react-native-worklets';

import { setThemeTransition } from '@/lib/appearance';

const FADE_MS = 300;
/** Give up on the snapshot (and just switch) if it hasn't rendered by then. */
const LOAD_TIMEOUT_MS = 500;

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/**
 * Crossfade for Light/Dark switches. Mount once, last in the root layout so it covers everything.
 *
 * Takes a screenshot of the current screen, shows it on top, switches the theme underneath,
 * then fades the screenshot out — the old colors melt into the new ones, native tabs and all.
 */
export function ThemeTransitionOverlay() {
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const opacity = useSharedValue(1);
  const onLoadRef = useRef<(() => void) | null>(null);
  const running = useRef(false);

  useEffect(() => {
    const clear = (uri: string) => {
      setSnapshot(null);
      releaseCapture(uri);
      running.current = false;
    };

    setThemeTransition(async (applyChange) => {
      if (running.current || (await AccessibilityInfo.isReduceMotionEnabled())) {
        applyChange();
        return;
      }
      running.current = true;

      let uri: string;
      try {
        uri = await captureScreen({ format: 'jpg', quality: 0.9, result: 'tmpfile' });
      } catch (e) {
        running.current = false;
        throw e; // setAppearance falls back to an instant switch
      }

      // Show the snapshot fully opaque and wait until it's actually on screen.
      opacity.value = 1;
      const loaded = await new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => resolve(false), LOAD_TIMEOUT_MS);
        onLoadRef.current = () => {
          clearTimeout(timer);
          resolve(true);
        };
        setSnapshot(uri);
      });
      onLoadRef.current = null;

      applyChange();
      if (!loaded) {
        clear(uri);
        return;
      }

      await nextFrame(); // let the new theme render under the snapshot
      await new Promise<void>((resolve) => {
        opacity.value = withTiming(0, { duration: FADE_MS, easing: Easing.out(Easing.quad) }, () => {
          scheduleOnRN(resolve);
        });
      });
      clear(uri);
    });

    return () => setThemeTransition(null);
  }, [opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (!snapshot) return null;

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Image
        source={{ uri: snapshot }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={0}
        cachePolicy="none"
        onLoad={() => onLoadRef.current?.()}
      />
    </Animated.View>
  );
}
