import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import type { DailyWord } from '@/api/types';
import { Chunky } from '@/components/chunky';
import { Icon, type IconName } from '@/components/icon';
import { DifficultyPill } from '@/components/pill';
import { ThemedText } from '@/components/themed-text';
import { difficultyColors, Edge, Radius, Spacing } from '@/constants/theme';
import {
  ACTION_H,
  CIRCLE_AIR,
  CIRCLE_LABEL_GAP,
  CIRCLE_MAX,
  CIRCLE_MIN,
  MAX_FONT_SCALE,
  OPEN_TEXT_MAX_SCALE,
  OPEN_TEXT_SPARE_SHARE,
  PAD_MAX,
  PAD_MIN,
  useTrailMetrics,
} from '@/features/today/layout';
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
 * collapsed cards hug their pill and word, and the open card takes all the remaining height, so the trail always
 * fills the space down to the tab bar. When the screen is too short, the trail keeps its sizes and the screen scrolls.
 */
export function Trail({ words, locked, selectedId, onSelect, openingId, onHunt, shareFor, onUnlock }: Props) {
  const metrics = useTrailMetrics();
  const selected = words.find((w) => w.id === selectedId)?.id ?? words[0]?.id;
  const collapsedCount = Math.max(0, words.length - 1);
  const cards = words.length + (locked ? 1 : 0);
  // Every card's height at zero vertical padding (the open card at its smallest).
  const bare = (words.length > 0 ? metrics.expanded : 0) + collapsedCount * metrics.collapsed + (locked ? metrics.locked : 0);
  const minHeight = bare + 2 * PAD_MIN * cards;

  // The trail's own height depends only on the screen, never on which card is open, so measuring it causes no shift.
  // From it: one vertical padding for every card (as much as fits without scrolling, within PAD_MIN..PAD_MAX),
  // compact rows from that, and the open row gets everything they leave. Rows animate between the two heights;
  // the opening and closing rows move on the same curve in opposite directions, so the total never changes:
  // nothing overshoots and the rows below glide instead of jumping. Rows render once the trail is measured
  // (one frame), so a row's size only ever comes from `height`, never from a flex fallback.
  const [trailH, setTrailH] = useState(0);
  const pad = cards > 0 ? Math.min(PAD_MAX, Math.max(PAD_MIN, (trailH - bare) / (2 * cards))) : PAD_MIN;
  const collapsedH = metrics.collapsed + 2 * pad;
  const lockedH = locked ? metrics.locked + 2 * pad : 0;
  const openMin = metrics.expanded + 2 * pad;
  const openH = Math.max(openMin, trailH - lockedH - collapsedCount * collapsedH);
  // The open card's text grows into part of its spare height (none on phones at the fit limit). It depends only on
  // the trail's size, so it never changes while a card opens or closes.
  const textScale = Math.min(
    OPEN_TEXT_MAX_SCALE,
    1 + ((openH - openMin) * OPEN_TEXT_SPARE_SHARE) / metrics.openText,
  );
  // The action button takes whatever the bigger text leaves, so its height is known without measuring: tall enough,
  // and it stacks a big icon above its label.
  const actionH = ACTION_H + (openH - openMin) - metrics.openText * (textScale - 1);
  // With room for at least CIRCLE_MIN after the label, air and edge, the action is a round shutter button
  // (0 = not enough room: the normal row button).
  const circleRoom = actionH - metrics.actionLabel - CIRCLE_LABEL_GAP - 2 * CIRCLE_AIR - Edge.button;
  const circle = circleRoom >= CIRCLE_MIN ? Math.floor(Math.min(CIRCLE_MAX, circleRoom)) : 0;

  return (
    // The rows live in an absolute layer, so the trail's height comes only from the screen (or minHeight on short
    // screens), never from its own rows. Otherwise, inside the ScrollView, rows sized to the trail could grow the
    // trail, which would be measured bigger and grow the rows again: a ratchet that never shrinks back.
    <View style={[styles.trail, { minHeight }]} onLayout={(e) => setTrailH(e.nativeEvent.layout.height)}>
      <View style={StyleSheet.absoluteFill}>
      {trailH > 0 && words.map((word, i) => (
        <TrailStop
          key={word.id}
          word={word}
          index={i}
          selected={word.id === selected}
          prevFound={i > 0 && words[i - 1].status === 'found'}
          isLast={i === words.length - 1 && !locked}
          collapsedH={collapsedH}
          openH={openH}
          pad={pad}
          textScale={textScale}
          circle={circle}
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
          height={lockedH}
          pad={pad}
          isFirst={words.length === 0}
          prevFound={words.length > 0 && words[words.length - 1].status === 'found'}
          onPress={onUnlock}
        />
      )}
      </View>
    </View>
  );
}

type StopProps = {
  word: DailyWord;
  index: number;
  selected: boolean;
  prevFound: boolean;
  isLast: boolean;
  /** Height of the row while collapsed. */
  collapsedH: number;
  /** Height of the row while open: the trail's spare height, never less than its content needs. */
  openH: number;
  /** The card's vertical padding, shared by every card in the trail whatever its state. */
  pad: number;
  /** How much the open card's text grows into its spare height (1 = the base sizes). */
  textScale: number;
  /** Diameter of the open card's round shutter button, or 0 when there's only room for the row button. */
  circle: number;
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
  collapsedH,
  openH,
  pad,
  textScale,
  circle,
  busy,
  onSelect,
  onHunt,
  onShare,
}: StopProps) {
  const theme = useTheme();
  const c = difficultyColors(theme, word.difficulty);
  const found = word.status === 'found';
  const progress = useOpenProgress(selected);
  // Open: the type scale grown by textScale. Collapsed: the base sizes.
  const s = selected ? textScale : 1;
  const smallText = { fontSize: Math.round(13 * s), lineHeight: Math.round(18 * s) };
  const wordText = selected
    ? { fontSize: Math.round(32 * s), lineHeight: Math.round(40 * s) }
    : styles.wordCollapsed;

  // The only layout property that animates: the row's height. Everything else is transform or opacity.
  const rowMotion = useAnimatedStyle(() => ({ height: collapsedH + (openH - collapsedH) * progress.value }));
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
            { backgroundColor: c.face, borderColor: c.main, paddingVertical: pad },
          ]}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <View style={styles.pillRow}>
                <DifficultyPill difficulty={word.difficulty} maxFontSizeMultiplier={MAX_FONT_SCALE} textStyle={smallText} />
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  numberOfLines={1}
                  maxFontSizeMultiplier={MAX_FONT_SCALE}
                  style={[styles.shrink, smallText]}>
                  {meta}
                </ThemedText>
              </View>
              {/* One line, shrunk to fit, so a long word never makes its card taller than its row. */}
              <ThemedText
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
                maxFontSizeMultiplier={MAX_FONT_SCALE}
                style={[styles.word, wordText]}>
                {displayWord(word.word)}
              </ThemedText>
            </View>
            <Animated.View style={chevronMotion}>
              <Icon name="chevron-right" size={20} color={theme.textSecondary} />
            </Animated.View>
          </View>

          {/* Status line under the word, button pinned to the card's bottom edge (it rides down as the card grows). */}
          {selected && (
            <Animated.View style={[styles.extras, extrasMotion]}>
              <View style={styles.info}>
                <StatusLine word={word} textStyle={smallText} iconSize={Math.round(16 * s)} />
                {word.firstFoundAt && (
                  <View style={styles.statusRow}>
                    <Icon name="clock" size={Math.round(16 * s)} color={theme.textSecondary} />
                    <ThemedText
                      type="small"
                      themeColor="textSecondary"
                      numberOfLines={1}
                      maxFontSizeMultiplier={MAX_FONT_SCALE}
                      style={[styles.shrink, smallText]}>
                      First found at {clockTime(word.firstFoundAt)}
                    </ThemedText>
                  </View>
                )}
              </View>
              {found ? (
                onShare && (
                  <ActionTile
                    word={word}
                    icon="share"
                    title="Share your find"
                    accessibilityLabel={`Share your ${word.word} find`}
                    circle={circle}
                    onPress={onShare}
                  />
                )
              ) : (
                <ActionTile
                  word={word}
                  icon="camera"
                  title={word.status === 'pending' ? 'See your result' : 'Hunt this word'}
                  accessibilityLabel={word.status === 'pending' ? `See the result for ${word.word}` : `Hunt for ${word.word}`}
                  circle={circle}
                  busy={busy}
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

/**
 * The open card's Hunt / Share button, in the word's difficulty colour. It fills the card's spare height:
 * when tall it stacks a big icon above its label, otherwise icon and label share one row.
 */
function ActionTile({
  word,
  icon,
  title,
  accessibilityLabel,
  circle,
  busy,
  onPress,
}: {
  word: DailyWord;
  icon: IconName;
  title: string;
  accessibilityLabel: string;
  /** Shutter diameter, or 0 for the row button. */
  circle: number;
  busy?: boolean;
  onPress: () => void;
}) {
  const c = difficultyColors(useTheme(), word.difficulty);

  if (circle > 0) {
    // A round shutter button centred in the spare space, its label underneath on the card face.
    return (
      <View style={styles.shutterArea}>
        <Chunky
          color={c.main}
          edgeColor={c.edge}
          radius={circle / 2}
          edge={Edge.button}
          disabled={busy}
          onPress={onPress}
          accessibilityLabel={accessibilityLabel}
          contentStyle={[styles.shutterFace, { width: circle, height: circle }]}>
          {busy ? (
            <ActivityIndicator color={c.on} size="large" />
          ) : (
            <Icon name={icon} size={Math.round(circle * 0.4)} color={c.on} />
          )}
        </Chunky>
        <ThemedText
          type="subtitle"
          numberOfLines={1}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          importantForAccessibility="no"
          style={{ color: c.text }}>
          {title}
        </ThemedText>
      </View>
    );
  }

  return (
    <Chunky
      color={c.main}
      edgeColor={c.edge}
      radius={18}
      edge={Edge.button}
      disabled={busy}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      style={styles.action}
      contentStyle={styles.actionFace}>
      {busy ? (
        <ActivityIndicator color={c.on} />
      ) : (
        <>
          <Icon name={icon} size={20} color={c.on} />
          <ThemedText
            numberOfLines={1}
            maxFontSizeMultiplier={MAX_FONT_SCALE}
            style={[styles.actionLabel, { color: c.on }]}>
            {title}
          </ThemedText>
        </>
      )}
    </Chunky>
  );
}

/** "09:42" (or "9:42 AM"), in the player's local time and clock style. */
function clockTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/** What the player knows about the word: their find, a photo being checked, or how many have found it. */
function StatusLine({
  word,
  textStyle,
  iconSize,
}: {
  word: DailyWord;
  textStyle: { fontSize: number; lineHeight: number };
  iconSize: number;
}) {
  const theme = useTheme();
  const sub = word.submission;

  if (word.status === 'found' && sub) {
    return (
      <View style={styles.statusRow}>
        <Icon name="check" size={iconSize} color={theme.successText} />
        <ThemedText
          type="smallBold"
          numberOfLines={1}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          style={[styles.shrink, textStyle, { color: theme.successText }]}>
          Found · +{sub.points} pts{sub.rank ? ` · ${ordinal(sub.rank)} finder` : ''}
        </ThemedText>
      </View>
    );
  }
  if (word.status === 'pending') {
    return (
      <ThemedText
        type="smallBold"
        themeColor="textSecondary"
        numberOfLines={1}
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        style={textStyle}>
        Checking your photo…
      </ThemedText>
    );
  }
  return (
    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE} style={textStyle}>
      {word.foundCount === 0
        ? 'Nobody has found it yet'
        : `${formatNumber(word.foundCount)} ${word.foundCount === 1 ? 'hunter has' : 'hunters have'} found it`}
    </ThemedText>
  );
}

/** The Premium word for free users: a locked stop that leads to the Premium screen. */
function LockedStop({
  height,
  pad,
  isFirst,
  prevFound,
  onPress,
}: {
  height: number;
  pad: number;
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
            { backgroundColor: theme.expertBg, borderColor: theme.expert, paddingVertical: pad, opacity: pressed ? 0.85 : 1 },
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
  const rows = Array.from({ length: count }, (_, i) => (i === 0 ? metrics.expanded : metrics.collapsed) + 2 * PAD_MIN);
  if (locked) rows.push(metrics.locked + 2 * PAD_MIN);

  return (
    <View style={styles.trail} accessibilityLabel="Loading">
      {/* Like the trail: the first (open) row takes the spare height, the rest stay compact. */}
      {rows.map((h, i) => (
        <View key={i} style={[styles.row, { flexBasis: h, flexGrow: i === 0 ? 1 : 0 }]}>
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
  extras: {
    flex: 1,
    paddingTop: Spacing.two,
    gap: Spacing.two + 4,
  },
  action: {
    flex: 1,
  },
  actionFace: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  shutterArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: CIRCLE_LABEL_GAP,
  },
  shutterFace: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontWeight: 900,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  info: {
    gap: 4,
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
