import type { Difficulty } from '@shared/types';

import { dayStartUtc } from '../lib/time';

export const MAX_POINTS: Record<Difficulty, number> = { easy: 100, medium: 250, hard: 500, expert: 1000 };

/** Points for a valid photo received at `receivedAt`: full points at 00:00 UTC, falling to 20% by midnight. */
export function pointsFor(difficulty: Difficulty, receivedAt: Date): number {
  const max = MAX_POINTS[difficulty];
  const elapsedH = (receivedAt.getTime() - dayStartUtc(receivedAt).getTime()) / 3_600_000;
  return Math.max(Math.round(max * 0.2), Math.round(max * (1 - elapsedH / 24)));
}

/**
 * Combo bonus for the 1st, 2nd and 3rd link of the day. A link is two adjacent trail nodes
 * (easy–medium, medium–hard, hard–expert) that are both found, in any order.
 */
export const COMBO_BONUS = [50, 100, 200] as const;

/** Bonus for a day on which `links` links are made: 1 → 50, 2 → 150, 3 → 350. */
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
 * Replays a day's valid finds in the order they were decided and credits each one with the bonus
 * its arrival added. The credits sum to the day's combo total.
 */
export function comboCredits<Id>(finds: { id: Id; position: number }[]): Map<Id, number> {
  const credits = new Map<Id, number>();
  const found: number[] = [];
  let total = 0;
  for (const f of finds) {
    found.push(f.position);
    const next = comboForLinks(linksAmong(found));
    credits.set(f.id, next - total);
    total = next;
  }
  return credits;
}
