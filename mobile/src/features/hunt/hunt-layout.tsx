import { useEffect, type ReactNode } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import type { DailyWord } from '@/api/types';
import { BADGE_HEIGHT, BADGE_WIDTH } from '@/components/illustrations/hunt-art';
import { DifficultyPill } from '@/components/pill';
import { Spinner } from '@/components/spinner';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Edge, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { displayWord } from '@/lib/format';

/** Content column width cap, so tablets and landscape get a phone-width column instead of a stretched one. */
const MAX_WIDTH = 480;
const TOP_BAR_HEIGHT = 48;

/**
 * The photo frame's height. It comes from the screen, never from the content below it, so the photo stays
 * put while the screen moves from "checking" to the verdict (no layout shift). About 38% of the usable
 * height (300 on a 390×844 phone, 340 at most); short phones give the photo less (30%, 170 at least) so
 * the score card and the main button still fit without scrolling.
 */
export function usePhotoHeight() {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const usable = height - insets.top - insets.bottom;
  const share = usable < 720 ? 0.3 : 0.38;
  return Math.round(Math.min(340, Math.max(170, usable * share)));
}

/**
 * Full-screen column for every non-camera hunt state: top bar, photo frame, status, actions.
 * It scrolls only when a small screen (or large text) can't fit it all; otherwise the actions sit at the bottom.
 */
export function HuntScreenShell({ children, after }: { children: ReactNode; after?: ReactNode }) {
  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex} edges={['top', 'bottom', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          alwaysBounceVertical={false}
          showsVerticalScrollIndicator={false}>
          <View style={styles.column}>{children}</View>
        </ScrollView>
      </SafeAreaView>
      {after}
    </ThemedView>
  );
}

/**
 * The word being hunted (difficulty pill over the word), centred. No close button: every state has a text
 * button that leaves the screen ("Done", "Give up for now", "Not now"…), and back still works.
 */
export function HuntTopBar({ word }: { word?: DailyWord }) {
  return (
    <View style={styles.topBar}>
      {word ? (
        <View style={styles.target}>
          <DifficultyPill
            difficulty={word.difficulty}
            style={styles.targetPill}
            textStyle={styles.targetPillText}
            maxFontSizeMultiplier={1.3}
          />
          <ThemedText
            style={styles.targetWord}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            maxFontSizeMultiplier={1.3}
            accessibilityRole="header">
            {displayWord(word.word)}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

/** The skeleton shown while today's words load: same frame, so nothing jumps when they arrive. */
export function HuntLoading() {
  const theme = useTheme();
  const photoHeight = usePhotoHeight();
  return (
    <HuntScreenShell>
      <View style={styles.topBar}>
        <View style={styles.target}>
          <View style={[styles.skelPill, { backgroundColor: theme.backgroundSelected }]} />
          <View style={[styles.skelWord, { backgroundColor: theme.backgroundSelected }]} />
        </View>
      </View>
      <View style={[styles.skelFrame, { height: photoHeight, backgroundColor: theme.backgroundSelected }]}>
        <Spinner color={theme.tint} />
      </View>
    </HuntScreenShell>
  );
}

/**
 * The card that holds the photo (or a placeholder). Its height is fixed by `usePhotoHeight`.
 * `badge` is a sticker pinned to the top-right corner (it overhangs the card; it never moves the layout).
 */
export function PhotoFrame({
  borderColor,
  badge,
  overlay,
  children,
}: {
  borderColor: string;
  badge?: ReactNode;
  /** Drawn over the photo, clipped to it (the checking scan band). */
  overlay?: ReactNode;
  children: ReactNode;
}) {
  const theme = useTheme();
  const height = usePhotoHeight();
  return (
    <View style={{ height }}>
      <View style={[styles.frame, { borderColor, backgroundColor: theme.backgroundElement }]}>
        <View style={[styles.photo, { backgroundColor: theme.backgroundSelected }]}>
          {children}
          {overlay}
        </View>
      </View>
      {badge ? <View style={styles.badge}>{badge}</View> : null}
    </View>
  );
}

const SCAN_HEIGHT = 55;
const SCAN_GLOW = 26;
const SCAN_LINE = 3;

/** "Checking": a red line with a soft glow on both sides that sweeps down the photo and back. */
export function ScanBand() {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const photoHeight = usePhotoHeight();
  const t = useSharedValue(reduced ? 0.4 : 0);

  useEffect(() => {
    if (reduced) return;
    t.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => cancelAnimation(t);
  }, [reduced, t]);

  // From fully above the photo to fully below it (the photo is the frame minus its 2+6 border and 2×10 padding).
  const travel = photoHeight - 28;
  const move = useAnimatedStyle(() => ({ transform: [{ translateY: -SCAN_HEIGHT + t.value * (travel + SCAN_HEIGHT) }] }));

  return (
    <Animated.View pointerEvents="none" importantForAccessibility="no-hide-descendants" style={[styles.scan, move]}>
      <Svg width="100%" height={SCAN_HEIGHT}>
        <Defs>
          <LinearGradient id="scan-up" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={theme.hard} stopOpacity={0} />
            <Stop offset="1" stopColor={theme.hard} stopOpacity={0.3} />
          </LinearGradient>
          <LinearGradient id="scan-down" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={theme.hard} stopOpacity={0.3} />
            <Stop offset="1" stopColor={theme.hard} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height={SCAN_GLOW} fill="url(#scan-up)" />
        <Rect x="0" y={SCAN_GLOW} width="100%" height={SCAN_LINE} fill={theme.hard} />
        <Rect x="0" y={SCAN_GLOW + SCAN_LINE} width="100%" height={SCAN_GLOW} fill="url(#scan-down)" />
      </Svg>
    </Animated.View>
  );
}

/** Headline, explanation or score card between the photo and the actions. */
export function HuntStatus({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.status, style]}>{children}</View>;
}

export function HuntActions({ children }: { children: ReactNode }) {
  return <View style={styles.actions}>{children}</View>;
}

export const huntStyles = StyleSheet.create({
  centerText: {
    textAlign: 'center',
  },
  caption: {
    textAlign: 'center',
    marginTop: -Spacing.one,
  },
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
  },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: MAX_WIDTH,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
    gap: Spacing.four - 4,
  },
  topBar: {
    height: TOP_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  target: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 2,
  },
  targetPill: {
    alignSelf: 'center',
    paddingHorizontal: 9,
    paddingVertical: 1,
  },
  targetPillText: {
    fontSize: 11,
    lineHeight: 16,
  },
  targetWord: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: 900,
    letterSpacing: 1,
  },
  frame: {
    flex: 1,
    padding: 10,
    borderRadius: Radius.lg,
    borderWidth: 2,
    borderBottomWidth: Edge.card,
  },
  photo: {
    flex: 1,
    borderRadius: Radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    right: -12,
    top: -16,
    width: BADGE_WIDTH,
    height: BADGE_HEIGHT,
    transform: [{ rotate: '10deg' }],
  },
  scan: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: SCAN_HEIGHT,
  },
  status: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  actions: {
    gap: 12,
  },
  skelPill: {
    width: 64,
    height: 14,
    borderRadius: Radius.pill,
  },
  skelWord: {
    width: 150,
    height: 20,
    borderRadius: 8,
    marginTop: 4,
  },
  skelFrame: {
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
