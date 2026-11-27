import { useEffect, useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
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
import { ShareIcon } from '@/components/hunt-icons';
import { Icon } from '@/components/icon';
import { DifficultyPill } from '@/components/pill';
import { HuntCameraIcon } from '@/components/tab-icons';
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
import { usePressGuard } from '@/hooks/use-press-guard';
import { useTheme } from '@/hooks/use-theme';
import { tap } from '@/lib/haptics';
import { trailLinks } from '@/lib/combo';
import { useFormat } from '@/lib/format';

const DURATION = 350;
const EASE = Easing.bezier(0.4, 0, 0.2, 1);
/** Width of the trail's node column; nodes are drawn at this size and scaled down when collapsed. */
const NODE = 52;
const NODE_COLLAPSED_SCALE = 44 / NODE;
const SEGMENT = 6;
/** Height of the combo chip on a link; half of it hangs into the next row. */
const CHIP_H = 24;

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
  // The open card's action is always the round shutter with its full caption (title and sentence), so the card needs
  // this much more than its smallest layout (which counts a 52px row button). Free trails have it to spare; a 4-word
  // Premium trail or large text takes it from the open text's growth, then from the card padding, then scrolls.
  const shutterMin = metrics.actionLabel + CIRCLE_LABEL_GAP + 2 * CIRCLE_AIR + Edge.button + CIRCLE_MIN;
  const shutterExtra = words.length > 0 ? Math.max(0, shutterMin - ACTION_H) : 0;
  const minHeight = bare + shutterExtra + 2 * PAD_MIN * cards;

  // The trail's own height depends only on the screen, never on which card is open, so measuring it causes no shift.
  // From it: one vertical padding for every card (as much as fits without scrolling, within PAD_MIN..PAD_MAX),
  // compact rows from that, and the open row gets everything they leave. Rows animate between the two heights;
  // the opening and closing rows move on the same curve in opposite directions, so the total never changes:
  // nothing overshoots and the rows below glide instead of jumping. Rows render once the trail is measured
  // (one frame), so a row's size only ever comes from `height`, never from a flex fallback.
  const [trailH, setTrailH] = useState(0);
  const padFor = (fixed: number) =>
    cards > 0 ? Math.min(PAD_MAX, Math.max(PAD_MIN, (trailH - fixed) / (2 * cards))) : PAD_MIN;
  // The padding as before; only when that leaves the open card too little for the shutter do the cards give some up.
  const roomyPad = padFor(bare);
  const pad = (trailH - bare) / (2 * cards) - roomyPad >= shutterExtra / (2 * cards) ? roomyPad : padFor(bare + shutterExtra);
  const collapsedH = metrics.collapsed + 2 * pad;
  const lockedH = locked ? metrics.locked + 2 * pad : 0;
  const openMin = metrics.expanded + 2 * pad;
  const openH = Math.max(openMin + shutterExtra, trailH - lockedH - collapsedCount * collapsedH);
  const spare = openH - openMin;
  // The open card's text grows into part of its spare height (none on phones at the fit limit), but never into the
  // shutter's minimum. It depends only on the trail's size, so it never changes while a card opens or closes.
  const textScale = Math.max(
    1,
    Math.min(
      OPEN_TEXT_MAX_SCALE,
      1 + (spare * OPEN_TEXT_SPARE_SHARE) / metrics.openText,
      1 + (ACTION_H + spare - shutterMin) / metrics.openText,
    ),
  );
  // The shutter takes whatever the bigger text leaves, so its size is known without measuring: at least CIRCLE_MIN
  // with its caption, air and edge.
  const actionH = ACTION_H + spare - metrics.openText * (textScale - 1);
  const circle = Math.floor(
    Math.min(CIRCLE_MAX, actionH - metrics.actionLabel - CIRCLE_LABEL_GAP - 2 * CIRCLE_AIR - Edge.button),
  );
  const links = trailLinks(words);

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
          nextSelected={words[i + 1]?.id === selected}
          prevFound={i > 0 && words[i - 1].status === 'found'}
          comboAbove={i > 0 && links.paid[i - 1] != null}
          linkBelow={i < words.length - 1 ? { paid: links.paid[i] ?? null, next: links.next } : null}
          isLast={i === words.length - 1 && !locked}
          zIndex={words.length - i}
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
  /** The next word's card is open (its row's height places the combo chip between the two nodes). */
  nextSelected: boolean;
  prevFound: boolean;
  /** The link to the word above is a combo (both found). */
  comboAbove: boolean;
  /**
   * The link to the next word: what it paid once both are found, or what the next link would pay.
   * null for the last word (nothing to link to, or only the locked Premium stop).
   */
  linkBelow: { paid: number | null; next: number | null } | null;
  isLast: boolean;
  /** Stacking order, so a link's chip (which straddles this row and the next) draws above the next row. */
  zIndex: number;
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
  nextSelected,
  prevFound,
  comboAbove,
  linkBelow,
  isLast,
  zIndex,
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
  const fmt = useFormat();
  const { t } = useTranslation();
  const theme = useTheme();
  const c = difficultyColors(theme, word.difficulty);
  const found = word.status === 'found';
  const progress = useOpenProgress(selected);
  // Open: the type scale grown by textScale. Collapsed: the base sizes.
  const s = selected ? textScale : 1;
  const smallText = { fontSize: Math.round(13 * s), lineHeight: Math.round(18 * s) };
  // The points beside the pill: the card's headline number. Its 20px line stays inside the pill's 18px line + 4px
  // padding at every scale the screen allows, so the row heights in trailMetrics don't change.
  const pointsText = { fontSize: Math.round(16 * s), lineHeight: Math.round(20 * s) };
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
  // The combo chip sits on the boundary with the next row; move it to the middle of the gap between the two nodes.
  // Each node is centred in its row, so with heights h (this row) and hn (next) the nodes' midpoint is (hn - h) / 4
  // below the boundary, and the gap between their edges is shifted by half the difference of their (scaled) radii.
  // The next row's progress runs on the same curve as that row's own, so the chip follows both rows as they animate.
  const nextProgress = useOpenProgress(nextSelected);
  const chipMotion = useAnimatedStyle(() => {
    const p = progress.value;
    const pn = nextProgress.value;
    const grow = openH - collapsedH;
    const shrink = (NODE / 2) * (1 - NODE_COLLAPSED_SCALE);
    return { transform: [{ translateY: ((pn - p) * grow) / 4 + ((p - pn) * shrink) / 2 }] };
  });

  const nodeColors = found
    ? { backgroundColor: theme.easyBg, borderColor: theme.easy }
    : selected
      ? { backgroundColor: c.bg, borderColor: c.main }
      : { backgroundColor: theme.backgroundElement, borderColor: c.main };
  const label = fmt.difficultyLabel(word.difficulty);
  const earned = (word.submission?.points ?? 0) + (word.submission?.comboPoints ?? 0);
  const meta =
    found && !selected
      ? t('trail.earned', { count: earned, points: fmt.formatNumber(earned) })
      : t('trail.upTo', { count: word.maxPoints, points: fmt.formatNumber(word.maxPoints) });
  const status = found ? t('trail.statusFound') : word.status === 'pending' ? t('trail.statusChecking') : t('trail.statusOpen');
  const comboLabel =
    linkBelow?.paid != null
      ? `, ${t('trail.comboPaidA11y', { count: linkBelow.paid })}`
      : linkBelow?.next != null
        ? `, ${t('trail.comboNextA11y', { count: linkBelow.next })}`
        : '';

  return (
    // The whole stop (node and card, edges included) opens it. Once open it isn't one accessibility element,
    // so screen readers can reach its Hunt/Share button.
    <AnimatedPressable
      accessible={!selected}
      accessibilityRole="button"
      accessibilityState={{ expanded: selected }}
      accessibilityLabel={`${fmt.displayWord(word.word)}, ${label}, ${meta}, ${status}${comboLabel}`}
      accessibilityHint={selected ? undefined : t('trail.showsWord')}
      onPress={selected ? undefined : onSelect}
      style={[styles.row, { zIndex }, rowMotion]}>
      <View style={styles.rail}>
        <Segment visible={index > 0} walked={prevFound} combo={comboAbove} />
        <Animated.View style={[styles.node, nodeColors, nodeMotion]} importantForAccessibility="no-hide-descendants">
          {found ? (
            <Icon name="check" size={24} color={theme.easyText} />
          ) : (
            <ThemedText style={[styles.nodeNumber, { color: c.text }]} maxFontSizeMultiplier={1}>
              {index + 1}
            </ThemedText>
          )}
        </Animated.View>
        <Segment visible={!isLast} walked={found} combo={linkBelow?.paid != null} />
        {linkBelow && <ComboChip paid={linkBelow.paid} next={linkBelow.next} motion={chipMotion} />}
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
                  style={[styles.shrink, styles.points, pointsText, found && !selected && { color: theme.successText }]}>
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
                {fmt.displayWord(word.word)}
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
                {/* Every state shows a second line: when it was first found, or an invitation to be first. */}
                {(word.firstFoundAt || !found) && (
                  <View style={styles.statusRow}>
                    <Icon
                      name={word.firstFoundAt ? 'clock' : 'trophy'}
                      size={Math.round(16 * s)}
                      color={theme.textSecondary}
                    />
                    <ThemedText
                      type="small"
                      themeColor="textSecondary"
                      numberOfLines={1}
                      maxFontSizeMultiplier={MAX_FONT_SCALE}
                      style={[styles.shrink, smallText]}>
                      {word.firstFoundAt ? t('trail.firstFoundAt', { time: fmt.clockTime(word.firstFoundAt) }) : t('trail.beFirst')}
                    </ThemedText>
                  </View>
                )}
              </View>
              {found ? (
                onShare && (
                  <ActionTile
                    word={word}
                    icon="share"
                    title={t('share.shareYourFind')}
                    subtitle={t('trail.shareSubtitle')}
                    accessibilityLabel={t('trail.shareA11y', { word: word.word })}
                    circle={circle}
                    onPress={onShare}
                  />
                )
              ) : (
                <ActionTile
                  word={word}
                  icon="camera"
                  title={word.status === 'pending' ? t('trail.seeResult') : t('trail.huntThis')}
                  subtitle={
                    word.status === 'pending'
                      ? t('trail.stillChecking')
                      : t('trail.snapToScore', { count: word.maxPoints, points: fmt.formatNumber(word.maxPoints) })
                  }
                  accessibilityLabel={
                    word.status === 'pending' ? t('trail.seeResultA11y', { word: word.word }) : t('trail.huntA11y', { word: word.word })
                  }
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
 * The open card's Hunt / Share button, in the word's difficulty colour: a round shutter centred in the card's spare
 * height, with its label and a short sentence underneath. The trail always leaves room for it (see Trail).
 */
function ActionTile({
  word,
  icon,
  title,
  subtitle,
  accessibilityLabel,
  circle,
  busy,
  onPress,
}: {
  word: DailyWord;
  icon: 'camera' | 'share';
  title: string;
  /**
   * A short sentence under the shutter's label. Keep it free of the word itself: labels are bare object names
   * ("scissors", "fire hydrant"), so articles and possessives go wrong.
   */
  subtitle: string;
  accessibilityLabel: string;
  /** Shutter diameter (CIRCLE_MIN..CIRCLE_MAX). */
  circle: number;
  busy?: boolean;
  onPress: () => void;
}) {
  const c = difficultyColors(useTheme(), word.difficulty);

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
        // The outer box is pinned to the circle plus its edge, so the face (which grows to fill it) stays round.
        style={{ width: circle, height: circle + Edge.button }}
        contentStyle={styles.shutterFace}>
        {busy ? (
          <ActivityIndicator color={c.on} size="large" />
        ) : icon === 'camera' ? (
          <HuntCameraIcon size={Math.round(circle * 0.5)} />
        ) : (
          <ShareIcon size={Math.round(circle * 0.5)} />
        )}
      </Chunky>
      <View style={styles.caption} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <ThemedText type="subtitle" numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE} style={{ color: c.text }}>
          {title}
        </ThemedText>
        <ThemedText
          type="small"
          themeColor="textSecondary"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          style={styles.captionText}>
          {subtitle}
        </ThemedText>
      </View>
    </View>
  );
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
  const fmt = useFormat();
  const { t } = useTranslation();
  const theme = useTheme();
  const sub = word.submission;

  if (word.status === 'found' && sub) {
    return (
      <View style={styles.statusRow}>
        <Icon name="check" size={iconSize} color={theme.successText} />
        <ThemedText
          type="smallBold"
          numberOfLines={1}
          // No adjustsFontSizeToFit: this line mounts while the card's row is still animating open, and Android fits
          // the text to that near-zero height once and never again, leaving it a few pixels tall. It fits by design.
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          style={[styles.shrink, textStyle, { color: theme.successText }]}>
          {/* One line: a combo takes the rank's place (the hunt result still shows the rank). */}
          {t('trail.foundPoints', { count: sub.points })}
          {sub.comboPoints > 0
            ? ` · ${t('trail.comboPoints', { points: sub.comboPoints })}`
            : sub.rank
              ? ` · ${t('format.nthFinder', { rank: fmt.ordinal(sub.rank) })}`
              : ''}
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
        {t('trail.checkingPhoto')}
      </ThemedText>
    );
  }
  return (
    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE} style={textStyle}>
      {word.foundCount === 0
        ? t('trail.nobodyYet')
        : t('trail.huntersFound', { count: word.foundCount, hunters: fmt.formatNumber(word.foundCount) })}
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
  const fmt = useFormat();
  const { t } = useTranslation();
  const theme = useTheme();
  const guard = usePressGuard();

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
          accessibilityLabel={t('trail.lockedA11y', { level: fmt.difficultyLabel('expert') })}
          onPress={guard(onPress)}
          style={({ pressed }) => [
            styles.lockCard,
            { backgroundColor: theme.expertBg, borderColor: theme.expert, paddingVertical: pad, opacity: pressed ? 0.85 : 1 },
          ]}>
          <View style={styles.lockText}>
            <ThemedText numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.lockTitle, { color: theme.expertText }]}>
              {t('trail.lockedTitle', { level: fmt.difficultyLabel('expert') })}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {t('trail.lockedSubtitle')}
            </ThemedText>
          </View>
          <ThemedText type="smallBold" maxFontSizeMultiplier={MAX_FONT_SCALE} style={{ color: theme.expertText }}>
            {t('trail.unlock')}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Half of the trail line above or below a node: orange when it's part of a combo (both its nodes found), green once
 * the player has walked it, otherwise the border color.
 */
function Segment({ visible, walked, combo = false }: { visible: boolean; walked: boolean; combo?: boolean }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.segment,
        visible && { backgroundColor: combo ? theme.tint : walked ? theme.success : theme.border },
      ]}
    />
  );
}

/**
 * The bonus on the link between two words, centred on the boundary between their rows: a solid orange chip with
 * what it paid once both are found, otherwise a faint hint with what linking them would pay.
 */
function ComboChip({
  paid,
  next,
  motion,
}: {
  paid: number | null;
  next: number | null;
  /** Moves the chip from the row boundary to the middle of the gap between the two nodes. */
  motion: ComponentProps<typeof Animated.View>['style'];
}) {
  const theme = useTheme();
  const value = paid ?? next;
  if (value == null) return null;
  const lit = paid != null;
  return (
    <Animated.View
      style={[styles.chipSlot, motion]}
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden>
      <View
        style={[
          styles.chip,
          lit
            ? [styles.chipLit, { backgroundColor: theme.tint, borderColor: theme.tintEdge }]
            : { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        ]}>
        {/* Fixed text size so the chip stays small; it may overhang the 52px rail (see chipSlot). */}
        <ThemedText maxFontSizeMultiplier={1} numberOfLines={1} style={[styles.chipText, { color: lit ? theme.onTint : theme.text }]}>
          +{value}
        </ThemedText>
      </View>
    </Animated.View>
  );
}

/** Placeholder rows in the trail's real sizes, so the loaded trail lands exactly where they were. */
export function TrailSkeleton({ count, locked }: { count: number; locked: boolean }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const metrics = useTrailMetrics();
  const rows = Array.from({ length: count }, (_, i) => (i === 0 ? metrics.expanded : metrics.collapsed) + 2 * PAD_MIN);
  if (locked) rows.push(metrics.locked + 2 * PAD_MIN);

  return (
    <View style={styles.trail} accessibilityLabel={t('common.loading')}>
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
  // Wider than the 52px rail: "+100" and "+200" need ~56px, and the rail has free space on both sides.
  chipSlot: {
    position: 'absolute',
    left: -16,
    right: -16,
    bottom: -CHIP_H / 2,
    height: CHIP_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    height: CHIP_H,
    minWidth: 44,
    paddingHorizontal: 8,
    borderRadius: CHIP_H / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** The earned chip gets the app's chunky bottom edge, so it reads as a badge on the orange line. */
  chipLit: {
    borderBottomWidth: 3,
  },
  // No tabular-nums here: on Android it makes the bold label measure narrower than it draws, clipping "+100" to "+10".
  chipText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: 900,
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
  points: {
    fontWeight: 800,
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
  shutterArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: CIRCLE_LABEL_GAP,
  },
  caption: {
    alignItems: 'center',
    gap: 2,
    maxWidth: '100%',
  },
  captionText: {
    textAlign: 'center',
  },
  shutterFace: {
    alignItems: 'center',
    justifyContent: 'center',
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
