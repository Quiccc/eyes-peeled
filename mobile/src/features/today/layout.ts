import { useWindowDimensions } from 'react-native';

/**
 * How far Dynamic Type may grow the Today screen's text. Every row height below is computed from the
 * same clamp, so the open card always fits its content and nothing is measured after the first frame.
 */
export const MAX_FONT_SCALE = 1.3;

/** Vertical space a row leaves around its card: 6px above and below. */
const ROW_PAD = 12;
/** A card's 2px top border plus its bottom edge. */
const BORDER_COLLAPSED = 2 + 5;
const BORDER_EXPANDED = 2 + 6;
/** The open card's padding, top and bottom. */
export const EXPANDED_PAD_V = 24;
/** "Hunt this word" / "Share your find": 52px face plus its 5px edge. */
const ACTION_H = 52 + 5;

/** Breathing room above and below a collapsed card's pill and word (3px each side). */
const COLLAPSED_AIR = 6;

export type TrailMetrics = {
  /** Fixed height of a collapsed word row: it hugs its pill and word. */
  collapsed: number;
  /** Smallest height of the open word row (what its content needs); it takes all the spare height above that. */
  expanded: number;
  /** Fixed height of the locked Premium row (free users). */
  locked: number;
};

/** Row heights for the Today trail, from the type scale and the (clamped) system text size. */
export function trailMetrics(fontScale: number): TrailMetrics {
  const fs = Math.min(fontScale, MAX_FONT_SCALE);
  const line = (h: number) => Math.ceil(h * fs);
  const pill = line(18) + 4;

  const collapsedContent = pill + 4 + line(26);
  // Pill, word, then the status line and button below an 8px gap; the button's label never outgrows its 52px face.
  const expandedContent = pill + 4 + line(40) + 8 + line(18) + 12 + ACTION_H;

  return {
    collapsed: ROW_PAD + BORDER_COLLAPSED + collapsedContent + COLLAPSED_AIR,
    expanded: ROW_PAD + BORDER_EXPANDED + EXPANDED_PAD_V * 2 + expandedContent,
    locked: ROW_PAD + 4 + line(22) + 2 + line(18) + 12,
  };
}

export function useTrailMetrics() {
  return trailMetrics(useWindowDimensions().fontScale);
}
