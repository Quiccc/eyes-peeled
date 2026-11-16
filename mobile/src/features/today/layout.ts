import { useWindowDimensions } from 'react-native';

/**
 * How far Dynamic Type may grow the Today screen's text. Every row height below is computed from the
 * same clamp, so the open card always fits its content and nothing is measured after the first frame.
 */
export const MAX_FONT_SCALE = 1.3;

/**
 * Every trail card (collapsed, open or locked) gets the same vertical padding. The trail picks it from its own
 * height: as much as fits without scrolling, between these bounds (the max matches the cards' side padding).
 */
export const PAD_MIN = 6;
export const PAD_MAX = 16;

/**
 * The open card's text grows into its spare height: up to this share of the spare goes to bigger text (the rest
 * stays as air above the button), and the text never grows past this scale (a modest step up from the base sizes).
 */
export const OPEN_TEXT_SPARE_SHARE = 0.5;
export const OPEN_TEXT_MAX_SCALE = 1.2;

/** Vertical space a row leaves around its card: 6px above and below. */
const ROW_PAD = 12;
/** A card's 2px top border plus its bottom edge. */
const BORDER_COLLAPSED = 2 + 5;
const BORDER_EXPANDED = 2 + 6;
/** The locked card's dashed 2px border, top and bottom. */
const BORDER_LOCKED = 2 + 2;
/** "Hunt this word" / "Share your find" at its smallest: 52px face plus its 5px edge. It grows into spare height. */
export const ACTION_H = 52 + 5;
/**
 * With enough spare height the action becomes a round shutter button (label underneath), sized between these.
 * The max keeps it inside even the narrowest card with side padding, so its width never needs measuring.
 */
export const CIRCLE_MIN = 52;
export const CIRCLE_MAX = 132;
/** Air above and below the shutter button and its caption, and the gap between them. */
export const CIRCLE_AIR = 4;
export const CIRCLE_LABEL_GAP = 8;

/** Row heights without the cards' vertical padding: row gap + borders + content. Add 2 × padding for the real height. */
export type TrailMetrics = {
  /** A collapsed word row: its pill and word. */
  collapsed: number;
  /**
   * The open word row at its smallest: pill, word, status line, first-find line and button.
   * It takes all the spare height above that.
   */
  expanded: number;
  /** The locked Premium row (free users). */
  locked: number;
  /**
   * The open card's text line heights at its base size (pill label + word + status line + first-find line);
   * the text scale grows these.
   */
  openText: number;
  /** The caption under the shutter button: its label (20/26) and a short sentence (13/18), 2px apart. */
  actionLabel: number;
};

/** Row heights for the Today trail, from the type scale and the (clamped) system text size. */
export function trailMetrics(fontScale: number): TrailMetrics {
  const fs = Math.min(fontScale, MAX_FONT_SCALE);
  const line = (h: number) => Math.ceil(h * fs);
  const pill = line(18) + 4;

  const collapsedContent = pill + 4 + line(26);
  // Pill, word, then the status and first-find lines (4px apart) and the button below an 8px gap; the button's
  // label never outgrows its 52px face. The first-find line is reserved even when it's hidden (nobody found it yet).
  const expandedContent = pill + 4 + line(40) + 8 + line(18) + 4 + line(18) + 12 + ACTION_H;
  const lockedContent = line(22) + 2 + line(18);

  return {
    collapsed: ROW_PAD + BORDER_COLLAPSED + collapsedContent,
    expanded: ROW_PAD + BORDER_EXPANDED + expandedContent,
    locked: ROW_PAD + BORDER_LOCKED + lockedContent,
    openText: line(18) + line(40) + line(18) + line(18),
    actionLabel: line(26) + 2 + line(18),
  };
}

export function useTrailMetrics() {
  return trailMetrics(useWindowDimensions().fontScale);
}
