import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

import type { LeaderboardEntry } from '@/api/types';
import { Avatar } from '@/components/avatar';
import { CountUp } from '@/components/celebration';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { usePressGuard } from '@/hooks/use-press-guard';
import { useTheme } from '@/hooks/use-theme';
import { displayName, formatNumber } from '@/lib/format';

/**
 * Entrance timeline (ms), from the design canvas: the bars rise bronze → silver → gold, then all three
 * players and their scores arrive together the moment the gold bar lands, then the crown pops on #1.
 */
const BAR_STAGGER = 120;
const BAR_MS = 550;
const PLAYERS_IN = 2 * BAR_STAGGER + BAR_MS;
const PLAYER_MS = 400;
const COUNT_MS = 900;
const CROWN_IN = PLAYERS_IN + 300;
const CROWN_MS = 350;
const END = PLAYERS_IN + COUNT_MS + 100;
/** The crown's shine sweeps across, then rests, on this cycle once it has landed. */
const SHINE_START = 1400;
const SHINE_CYCLE = 2600;

const AVATAR = [72, 56, 56];
const BAR = [72, 52, 40];

function progress(t: number, delay: number, duration: number) {
  'worklet';
  return Math.min(1, Math.max(0, (t - delay) / duration));
}
function easeOutCubic(x: number) {
  'worklet';
  return 1 - Math.pow(1 - x, 3);
}
function easeOutBack(x: number) {
  'worklet';
  const c1 = 1.4;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

type Props = {
  /** The top three entries (fewer on a small board), best first. */
  entries: readonly LeaderboardEntry[];
  /** The signed-in player, shown as "You" and not linked. */
  myId?: string;
};

/**
 * The top three on medal bars, 2-1-3. Plays its entrance once when mounted; remount it (a `key`) to replay,
 * e.g. when the scope or the top three change. Under Reduce Motion it appears in place.
 */
export function Podium({ entries, myId }: Props) {
  const reduced = useReducedMotion();
  const t = useSharedValue(reduced ? END : 0);

  useEffect(() => {
    if (reduced) {
      t.value = END;
      return;
    }
    t.value = withTiming(END, { duration: END, easing: Easing.linear });
    return () => cancelAnimation(t);
  }, [reduced, t]);

  const top = entries.slice(0, 3);
  // Silver left, gold centre, bronze right.
  const order = top.length === 3 ? [1, 0, 2] : top.length === 2 ? [1, 0] : [0];

  return (
    <View style={styles.row}>
      {order.map((i) => (
        <PodiumColumn key={top[i].user.id} entry={top[i]} place={i} t={t} mine={top[i].user.id === myId} />
      ))}
    </View>
  );
}

function PodiumColumn({
  entry,
  place,
  t,
  mine,
}: {
  entry: LeaderboardEntry;
  place: number;
  t: SharedValue<number>;
  mine: boolean;
}) {
  const theme = useTheme();
  const router = useRouter();
  const guard = usePressGuard();
  const medal = [theme.gold, theme.silver, theme.bronze][place];
  const barDelay = (2 - place) * BAR_STAGGER;

  const barStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: easeOutBack(progress(t.value, barDelay, BAR_MS)) }],
  }));
  const rankStyle = useAnimatedStyle(() => ({ opacity: progress(t.value, barDelay + BAR_MS - 100, 200) }));
  const playerStyle = useAnimatedStyle(() => {
    const p = progress(t.value, PLAYERS_IN, PLAYER_MS);
    const a = easeOutCubic(p);
    return { opacity: a, transform: [{ translateY: 12 * (1 - a) }, { scale: 0.7 + 0.3 * easeOutBack(p) }] };
  });
  const nameStyle = useAnimatedStyle(() => ({ opacity: easeOutCubic(progress(t.value, PLAYERS_IN, PLAYER_MS)) }));

  const name = mine ? 'You' : displayName(entry.user);
  const player = (
    <Animated.View style={playerStyle}>
      <Avatar user={entry.user} size={AVATAR[place]} ringColor={medal} />
    </Animated.View>
  );

  return (
    <View
      style={styles.column}
      accessible
      accessibilityLabel={`${['First', 'Second', 'Third'][place]} place, ${name}, ${formatNumber(entry.points)} points`}>
      {place === 0 && <Crown t={t} />}
      {mine ? (
        player
      ) : (
        <Pressable
          accessibilityRole="link"
          hitSlop={8}
          onPress={guard(() => router.push({ pathname: '/user/[userId]', params: { userId: entry.user.id } }))}>
          {player}
        </Pressable>
      )}
      <Animated.View style={[styles.nameWrap, nameStyle]}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {name}
        </ThemedText>
      </Animated.View>
      {/* The score arrives with its player, then counts up. */}
      <Animated.View style={nameStyle}>
        <CountUp
          value={entry.points}
          delay={PLAYERS_IN}
          duration={COUNT_MS}
          format={formatNumber}
          style={[styles.points, { color: theme.scoreNumber }]}
        />
      </Animated.View>
      <Animated.View
        style={[styles.bar, { height: BAR[place], backgroundColor: medal }, barStyle]}
        importantForAccessibility="no-hide-descendants">
        <Animated.View style={rankStyle}>
          <ThemedText type="subtitle" style={{ color: theme.onMedal }}>
            {place + 1}
          </ThemedText>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const CROWN = 'M4 8l5.5 5L15 5l5.5 8L26 8l-2.5 12h-17z';
const GLINT = 'M5 0l1.2 3.8L10 5 6.2 6.2 5 10 3.8 6.2 0 5l3.8-1.2z';

/** The gold crown over #1: pops in after the players, then a shine sweeps across it now and then. */
function Crown({ t }: { t: SharedValue<number> }) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const shine = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    shine.value = withDelay(
      SHINE_START,
      withRepeat(withTiming(1, { duration: SHINE_CYCLE, easing: Easing.linear }), -1, false),
    );
    return () => cancelAnimation(shine);
  }, [reduced, shine]);

  const popStyle = useAnimatedStyle(() => {
    const p = progress(t.value, CROWN_IN, CROWN_MS);
    return {
      opacity: Math.min(1, p * 3),
      transform: [{ rotate: `${-12 * (1 - p)}deg` }, { scale: easeOutBack(p) }],
    };
  });
  // The band crosses in the first 35% of each cycle, then waits off to the right.
  const bandProps = useAnimatedProps(() => {
    const s = shine.value;
    const k = s < 0.35 ? s / 0.35 : 1;
    const eased = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    return { x: -10 + 44 * eased };
  });

  return (
    <Animated.View style={[styles.crown, popStyle]} importantForAccessibility="no-hide-descendants">
      <Svg width={30} height={24} viewBox="0 0 30 24">
        <Defs>
          <ClipPath id="podiumCrownClip">
            <Path d={CROWN} />
          </ClipPath>
        </Defs>
        <Path d={CROWN} fill={theme.gold} />
        {!reduced && (
          <G clipPath="url(#podiumCrownClip)">
            <AnimatedRect animatedProps={bandProps} y={-4} width={5} height={32} fill="#FFFFFF" opacity={0.85} transform="skewX(-14)" />
          </G>
        )}
        <Path d={`${CROWN}M6.5 20h17`} fill="none" stroke={theme.onMedal} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {[
          [3.5, 6],
          [15, 3],
          [26.5, 6],
        ].map(([cx, cy]) => (
          <Circle key={cx} cx={cx} cy={cy} r={2} fill={theme.gold} stroke={theme.onMedal} strokeWidth={2} />
        ))}
      </Svg>
      {!reduced && (
        <>
          <Glint shine={shine} offset={0.06} size={11} style={styles.glintLeft} />
          <Glint shine={shine} offset={0.21} size={9} style={styles.glintRight} />
        </>
      )}
    </Animated.View>
  );
}

/** A small sparkle that twinkles once per shine cycle, `offset` into the cycle. */
function Glint({
  shine,
  offset,
  size,
  style,
}: {
  shine: SharedValue<number>;
  offset: number;
  size: number;
  style: object;
}) {
  const theme = useTheme();
  const glintStyle = useAnimatedStyle(() => {
    if (shine.value === 0) return { opacity: 0 };
    const f = (shine.value - offset + 1) % 1;
    // Grows and spins in over 15% of the cycle, then shrinks away over the next 15%.
    const p = f < 0.15 ? f / 0.15 : f < 0.3 ? 1 - (f - 0.15) / 0.15 : 0;
    return { opacity: p, transform: [{ scale: p }, { rotate: `${f * 300}deg` }] };
  });
  return (
    <Animated.View style={[styles.glint, style, glintStyle]}>
      <Svg width={size} height={size} viewBox="0 0 10 10">
        <Path d={GLINT} fill={theme.gold} stroke={theme.onMedal} strokeWidth={0.8} strokeLinejoin="round" />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  column: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
  },
  crown: {
    marginBottom: Spacing.one,
  },
  glint: {
    position: 'absolute',
  },
  glintLeft: {
    left: -11,
    top: -3,
  },
  glintRight: {
    right: -10,
    top: 7,
  },
  nameWrap: {
    marginTop: 6,
    maxWidth: '100%',
  },
  points: {
    fontWeight: 900,
    fontVariant: ['tabular-nums'],
  },
  bar: {
    alignSelf: 'stretch',
    marginTop: Spacing.two,
    paddingTop: 6,
    alignItems: 'center',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 2,
    borderBottomWidth: 0,
    borderColor: 'rgba(43,33,24,0.18)',
    transformOrigin: 'bottom',
  },
});
