import type { Difficulty } from '@shared/types';

import { dayStartUtc } from '../lib/time';

export const MAX_POINTS: Record<Difficulty, number> = { easy: 100, medium: 250, hard: 500, expert: 1000 };

/** Points for a valid photo received at `receivedAt`: full points at 00:00 UTC, falling to 20% by midnight. */
export function pointsFor(difficulty: Difficulty, receivedAt: Date): number {
  const max = MAX_POINTS[difficulty];
  const elapsedH = (receivedAt.getTime() - dayStartUtc(receivedAt).getTime()) / 3_600_000;
  return Math.max(Math.round(max * 0.2), Math.round(max * (1 - elapsedH / 24)));
}
