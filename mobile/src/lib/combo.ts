import type { DailyWord } from '@/api/types';

/**
 * Combos: two adjacent words on the Today trail that are both found (in any order) make a link, and each
 * link of the day pays more than the one before. The server decides the real bonus (Submission.comboPoints);
 * these mirror its rules (server/src/services/scoring.ts) for the mock backend and the trail's labels.
 */
export const COMBO_BONUS = [50, 100, 200] as const;

/** Total bonus for a day with `links` links: 1 → 50, 2 → 150, 3 → 350. */
export function comboForLinks(links: number): number {
  return COMBO_BONUS.slice(0, links).reduce((sum, b) => sum + b, 0);
}

/** Links made by the found trail positions (0 = easy … 3 = expert). */
export function linksAmong(found: Iterable<number>): number {
  const set = new Set(found);
  let links = 0;
  for (const i of set) if (set.has(i + 1)) links++;
  return links;
}

/**
 * The bonus each trail link shows, by link index (link i joins words i and i+1): what it paid when lit, in
 * the order the links were made, or null while it isn't lit. Also the bonus the next link would pay.
 */
export function trailLinks(words: DailyWord[]): { paid: (number | null)[]; next: number | null } {
  const madeAt = (w: DailyWord) => (w.status === 'found' && w.submission ? w.submission.createdAt : null);
  const lit = words.slice(0, -1).flatMap((w, i) => {
    const a = madeAt(w);
    const b = madeAt(words[i + 1]);
    return a && b ? [{ i, at: a > b ? a : b }] : [];
  });
  lit.sort((x, y) => (x.at === y.at ? x.i - y.i : x.at < y.at ? -1 : 1));
  const paid: (number | null)[] = words.slice(0, -1).map(() => null);
  lit.forEach((l, k) => (paid[l.i] = COMBO_BONUS[k] ?? 0));
  return { paid, next: COMBO_BONUS[lit.length] ?? null };
}

/** The day's combo bonus so far, from the player's finds. */
export function comboPointsOf(words: DailyWord[]): number {
  return words.reduce((sum, w) => sum + (w.status === 'found' ? (w.submission?.comboPoints ?? 0) : 0), 0);
}
