import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import type { DailyWord } from '@/api/types';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { DifficultyPill } from '@/components/pill';
import { ThemedText } from '@/components/themed-text';
import { difficultyColors, Radius, Spacing } from '@/constants/theme';
import { EXPANDED_PAD_V, MAX_FONT_SCALE, useTrailMetrics, type TrailMetrics } from '@/features/today/layout';
import { useTheme } from '@/hooks/use-theme';
import { tap } from '@/lib/haptics';
import { DIFFICULTY_LABEL, displayWord, formatNumber, ordinal } from '@/lib/format';

const DURATION = 350;
const EASE = Easing.bezier(0.4, 0, 0.2, 1);
/** Width of the trail's node column; nodes are drawn at this size and scaled down when collapsed. */
const NODE = 52;
const NODE_COLLAPSED_SCALE = 44 / NODE;
const SEGMENT = 6;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  words: DailyWord[];
  /** Free users get a locked Premium stop at the end of the trail. */
  locked: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** The word whose hunt is opening (an ad is showing), so its button spins. */
  openingId: string | null;
  onHunt: (word: DailyWord) => void;
  /** Returns the share action for a found word, or undefined when it can't be shared. */
  shareFor: (word: DailyWord) => (() => void) | undefined;
  onUnlock: () => void;
};

/**
 * Today's words as stops on a trail. One card is open at a time (the first one until the player picks another):
 * the open card has a fixed height from the type scale, and the collapsed cards share the rest of the space.
 * When the screen is too short for all of that, the trail keeps its sizes and the screen scrolls.
 */
export function Trail({ words, locked, selectedId, onSelect, openingId, onHunt, shareFor, onUnlock }: Props) {
  const metrics = useTrailMetrics();
  const selected = words.find((w) => w.id === selectedId)?.id ?? words[0]?.id;
  const lockedH = locked ? metrics.locked : 0;
  const minHeight = (words.length > 0 ? metrics.expanded + (words.length - 1) * metrics.collapsed : 0) + lockedH;

  // The trail's own height depends only on the screen, never on which card is open, so measuring it causes no shift.
  // From it, every collapsed row gets one explicit height; rows then animate between that and the open height.
  // The opening and closing rows move on the same curve in opposite directions, so the total never changes:
  // nothing overshoots and the rows below glide instead of jumping. Rows render once the trail is measured
  // (one frame), so a row's size only ever comes from `height`, never from a flex fallback.
  const [trailH, setTrailH] = useState(0);
  const others = Math.max(1, words.length - 1);
  const collapsedH = Math.max(metrics.collapsed, (trailH - metrics.expanded - lockedH) / others);

  return (
    <View style={[styles.trail, { minHeight }]} onLayout={(e) => setTrailH(e.nativeEvent.layout.height)}>
      {trailH > 0 && words.map((word, i) => (
        <TrailStop
          key={word.id}
          word={word}
          index={i}
          selected={word.id === selected}
          prevFound={i > 0 && words[i - 1].status === 'found'}
          isLast={i === words.length - 1 && !locked}
          metrics={metrics}
          collapsedH={collapsedH}
          busy={openingId === word.id}
          onSelect={() => {
            tap();
            onSelect(word.id);
          }}
          onHunt={() => onHunt(word)}
          onShare={shareFor(word)}
        />
      ))}
      {trailH > 0 && locked && (
        <LockedStop
          height={metrics.locked}
          isFirst={words.length === 0}
          prevFound={words.length > 0 && words[words.length - 1].status === 'found'}
          onPress={onUnlock}
        />
      )}
    </View>
  );
}

type StopProps = {
  word: DailyWord;
  index: number;
  selected: boolean;
  prevFound: boolean;
  isLast: boolean;
  metrics: TrailMetrics;
  /** Height of a collapsed row in this trail (from the trail's measured height). */
  collapsedH: number;
  busy: boolean;
  onSelect: () => void;
  onHunt: () => void;
  onShare?: () => void;
};

function TrailStop({
  word,
  index,
  selected,
  prevFound,
  isLast,
  metrics,
  collapsedH,
  busy,
  onSelect,
  onHunt,
  onShare,
}: StopProps) {
  const theme = useTheme();
  const c = difficultyColors(theme, word.difficulty);
  const found = word.status === 'found';
  const progress = useOpenProgress(selected);
  const { expanded } = metrics;

  // The only layout property that animates: the row's height. Everything else is transform or opacity.
  const rowMotion = useAnimatedStyle(() => ({ height: collapsedH + (expanded - collapsedH) * progress.value }));
  const nodeMotion = useAnimatedStyle(() => ({
    transform: [{ scale: NODE_COLLAPSED_SCALE + (1 - NODE_COLLAPSED_SCALE) * progress.value }],
  }));
  const chevronMotion = useAnimatedStyle(() => ({ transform: [{ rotate: `${90 * progress.value}deg` }] }));
  const extrasMotion = useAnimatedStyle(() => ({
    opacity: Math.max(0, (progress.value - 0.35) / 0.65),
    transform: [{ translateY: (1 - progress.value) * 8 }],
  }));

  const nodeColors = found
    ? { backgroundColor: theme.easyBg, borderColor: theme.easy }
    : selected
      ? { backgroundColor: c.bg, borderColor: c.main }
      : { backgroundColor: theme.backgroundElement, borderColor: c.main };
  const label = DIFFICULTY_LABEL[word.difficulty];
  const meta = found && !selected ? `+${word.submission?.points ?? 0} pts` : `up to ${formatNumber(word.maxPoints)} pts`;
  const status = found ? 'found' : word.status === 'pending' ? 'being checked' : 'not found yet';

  return (
    // The whole stop (node and card, edges included) opens it. Once open it isn't one accessibility element,
    // so screen readers can reach its Hunt/Share button.
    <AnimatedPressable
      accessible={!selected}
      accessibilityRole="button"
      accessibilityState={{ expanded: selected }}
      accessibilityLabel={`${displayWord(word.word)}, ${label}, ${meta}, ${status}`}
      accessibilityHint={selected ? undefined : 'Shows this word'}
      onPress={selected ? undefined : onSelect}
      style={[styles.row, rowMotion]}>
      <View style={styles.rail}>
        <Segment visible={index > 0} walked={prevFound} />
        <Animated.View style={[styles.node, nodeColors, nodeMotion]} importantForAccessibility="no-hide-descendants">
          {found ? (
            <Icon name="check" size={24} color={theme.easyText} />
          ) : (
            <ThemedText style={[styles.nodeNumber, { color: c.text }]} maxFontSizeMultiplier={1}>
              {index + 1}
            </ThemedText>
          )}
        </Animated.View>
        <Segment visible={!isLast} walked={found} />
      </View>

      <View style={styles.cardSlot}>
        <View
          style={[
            styles.card,
            selected ? styles.cardExpanded : styles.cardCollapsed,
            { backgroundColor: c.face, borderColor: c.main },
          ]}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <View style={styles.pillRow}>
                <DifficultyPill difficulty={word.difficulty} maxFontSizeMultiplier={MAX_FONT_SCALE} />
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  numberOfLines={1}
                  maxFontSizeMultiplier={MAX_FONT_SCALE}
                  style={styles.shrink}>
                  {meta}
                </ThemedText>
              </View>
              {/* One line, shrunk to fit, so a long word never makes its card taller than its row. */}
              <ThemedText
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
                maxFontSizeMultiplier={MAX_FONT_SCALE}
                style={[styles.word, selected ? styles.wordExpanded : styles.wordCollapsed]}>
                {displayWord(word.word)}
              </ThemedText>
            </View>
            <Animated.View style={chevronMotion}>
              <Icon name="chevron-right" size={20} color={theme.textSecondary} />
            </Animated.View>
          </View>

          {selected && (
            <Animated.View
              style={[styles.extras, extrasMotion]}
              onLayout={__DEV__ ? (e) => warnIfClipped(e.nativeEvent.layout.height, metrics) : undefined}>
              <StatusLine word={word} />
              {found ? (
                onShare && (
                  <Button
                    variant="success"
                    icon="share"
                    title="Share your find"
                    accessibilityLabel={`Share your ${word.word} find`}
                    maxFontSizeMultiplier={MAX_FONT_SCALE}
                    onPress={onShare}
                  />
                )
              ) : (
                <Button
                  icon="camera"
                  title={word.status === 'pending' ? 'See your result' : 'Hunt this word'}
                  accessibilityLabel={word.status === 'pending' ? `See the result for ${word.word}` : `Hunt for ${word.word}`}
                  loading={busy}
                  maxFontSizeMultiplier={MAX_FONT_SCALE}
                  onPress={onHunt}
                />
              )}
            </Animated.View>
          )}
        </View>
      </View>
    </AnimatedPressable>
  );
}

/** What the player knows about the word: their find, a photo being checked, or how many have found it. */
function StatusLine({ word }: { word: DailyWord }) {
  const theme = useTheme();
  const sub = word.submission;

  if (word.status === 'found' && sub) {
    return (
      <View style={styles.statusRow}>
        <Icon name="check" size={16} color={theme.successText} />
        <ThemedText
          type="smallBold"
          numberOfLines={1}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          style={[styles.shrink, { color: theme.successText }]}>
          Found · +{sub.points} pts{sub.rank ? ` · ${ordinal(sub.rank)} finder` : ''}
        </ThemedText>
      </View>
    );
  }
  if (word.status === 'pending') {
    return (
      <ThemedText type="smallBold" themeColor="textSecondary" numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        Checking your photo…
      </ThemedText>
    );
  }
  return (
    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
      {word.foundCount === 0
        ? 'Nobody has found it yet'
        : `${formatNumber(word.foundCount)} ${word.foundCount === 1 ? 'hunter has' : 'hunters have'} found it`}
    </ThemedText>
  );
}

/** The Premium word for free users: a locked stop that leads to the Premium screen. */
function LockedStop({
  height,
  isFirst,
  prevFound,
  onPress,
}: {
  height: number;
  isFirst: boolean;
  prevFound: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.row, { height }]}>
      <View style={styles.rail}>
        <Segment visible={!isFirst} walked={prevFound} />
        <View
          style={[styles.lockNode, { backgroundColor: theme.expertBg, borderColor: theme.expert }]}
          importantForAccessibility="no-hide-descendants">
          <Icon name="lock" size={20} color={theme.expertText} />
        </View>
        <Segment visible={false} walked={false} />
      </View>
      <View style={styles.cardSlot}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${DIFFICULTY_LABEL.expert} word, up to 1000 points, locked. Unlock with Premium.`}
          onPress={onPress}
          style={({ pressed }) => [
            styles.lockCard,
            { backgroundColor: theme.expertBg, borderColor: theme.expert, opacity: pressed ? 0.85 : 1 },
          ]}>
          <View style={styles.lockText}>
            <ThemedText numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.lockTitle, { color: theme.expertText }]}>
              {DIFFICULTY_LABEL.expert} word
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Up to 1000 pts, plus no ads
            </ThemedText>
          </View>
          <ThemedText type="smallBold" maxFontSizeMultiplier={MAX_FONT_SCALE} style={{ color: theme.expertText }}>
            Unlock
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

/** Half of the trail line above or below a node: green once the player has walked it, otherwise the border color. */
function Segment({ visible, walked }: { visible: boolean; walked: boolean }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.segment,
        visible && { backgroundColor: walked ? theme.success : theme.border },
      ]}
    />
  );
}

/** Placeholder rows in the trail's real sizes, so the loaded trail lands exactly where they were. */
export function TrailSkeleton({ count, locked }: { count: number; locked: boolean }) {
  const theme = useTheme();
  const metrics = useTrailMetrics();
  const rows = Array.from({ length: count }, (_, i) => (i === 0 ? metrics.expanded : metrics.collapsed));
  if (locked) rows.push(metrics.locked);

  return (
    <View style={styles.trail} accessibilityLabel="Loading">
      {rows.map((h, i) => (
        <View key={i} style={[styles.row, { flexBasis: h, flexGrow: i === 0 || (locked && i === rows.length - 1) ? 0 : 1 }]}>
          <View style={styles.rail} />
          <View style={styles.cardSlot}>
            <View style={[styles.skeleton, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** 0 when collapsed, 1 when open; animates between them unless Reduce Motion is on. */
function useOpenProgress(open: boolean): SharedValue<number> {
  const reduced = useReducedMotion();
  const progress = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    const target = open ? 1 : 0;
    progress.value = reduced ? target : withTiming(target, { duration: DURATION, easing: EASE });
  }, [open, reduced, progress]);
  return progress;
}

/** Development guard: the open row's height is computed, so warn if its content ever outgrows it. */
function warnIfClipped(extrasHeight: number, metrics: TrailMetrics) {
  if (extrasHeight > metrics.expandedExtras + 1) {
    console.warn(
      `Today trail: the open card's status and button take ${extrasHeight}px but only ${metrics.expandedExtras}px is reserved.`,
    );
  }
}

const styles = StyleSheet.create({
  trail: {
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two + 4,
    minHeight: 0,
  },
  rail: {
    width: NODE,
    alignItems: 'center',
  },
  segment: {
    flex: 1,
    width: SEGMENT,
  },
  node: {
    width: NODE,
    height: NODE,
    borderRadius: NODE / 2,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeNumber: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: 900,
  },
  lockNode: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardSlot: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 6,
  },
  card: {
    flex: 1,
    overflow: 'hidden',
    borderWidth: 2,
  },
  cardCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 20,
    borderBottomWidth: 5,
  },
  cardExpanded: {
    justifyContent: 'flex-start',
    paddingHorizontal: Spacing.three,
    paddingVertical: EXPANDED_PAD_V,
    borderRadius: 28,
    borderBottomWidth: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  shrink: {
    flexShrink: 1,
  },
  word: {
    fontWeight: 900,
    letterSpacing: 0.5,
  },
  wordCollapsed: {
    fontSize: 20,
    lineHeight: 26,
  },
  wordExpanded: {
    fontSize: 32,
    lineHeight: 40,
  },
  extras: {
    paddingTop: Spacing.two,
    gap: Spacing.two + 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lockCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 4,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  lockText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  lockTitle: {
    fontWeight: 900,
  },
  skeleton: {
    flex: 1,
    borderRadius: Radius.lg,
    borderWidth: 2,
  },
});
