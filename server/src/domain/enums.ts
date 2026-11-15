import type { Difficulty } from '@shared/types';

/**
 * The fixed value sets of the game. The DB schema, request validation and the admin panel all use
 * these, so a new value is added in one place.
 */

/** Easiest first. Also the order words are shown in. */
export const difficulties = ['easy', 'medium', 'hard', 'expert'] as const satisfies readonly Difficulty[];

export const submissionStatuses = ['pending', 'valid', 'invalid', 'removed'] as const;

export const reportReasons = ['inappropriate', 'spam', 'cheating', 'other'] as const;
export type ReportReason = (typeof reportReasons)[number];

export const reportStatuses = ['open', 'resolved'] as const;
export type ReportStatus = (typeof reportStatuses)[number];

/** Sort comparator: easy → expert. */
export const byDifficulty = (a: { difficulty: Difficulty }, b: { difficulty: Difficulty }) =>
  difficulties.indexOf(a.difficulty) - difficulties.indexOf(b.difficulty);
