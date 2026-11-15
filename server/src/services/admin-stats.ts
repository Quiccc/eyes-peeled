import { and, asc, eq, gte, lte, sql } from 'drizzle-orm';

import type { Difficulty } from '@shared/types';

import type { Ctx } from '../context';
import { dailyWords, difficulties, submissions, words } from '../db/schema';
import { HttpError } from '../lib/errors';
import { addDays, utcDate } from '../lib/time';

export type WordDayStats = {
  date: string;
  difficulty: Difficulty;
  label: string;
  attempts: number;
  valid: number;
  invalid: number;
  /** valid / (valid + invalid); null with no decided attempts */
  passRate: number | null;
  finders: number;
  /** Average confidence of rejected photos that had one: close to the threshold = maybe too strict */
  avgInvalidConfidence: number | null;
};

const MAX_RANGE_DAYS = 120;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Per daily word in [from, to]. Defaults to the last 30 days. Removed photos count as valid finds. */
export async function wordStats(ctx: Ctx, range: { from?: string; to?: string }): Promise<WordDayStats[]> {
  const to = range.to ?? utcDate(ctx.clock.now());
  const from = range.from ?? addDays(to, -29);
  if (!DATE.test(from) || !DATE.test(to)) throw new HttpError(400, 'bad_request', 'Dates must look like 2026-12-01.');
  if (from > to) throw new HttpError(400, 'bad_request', '"from" must be on or before "to".');
  if (addDays(from, MAX_RANGE_DAYS) < to) {
    throw new HttpError(400, 'bad_request', `Pick at most ${MAX_RANGE_DAYS} days.`);
  }

  const isValid = sql`${submissions.status} in ('valid', 'removed')`;
  const rows = await ctx.db
    .select({
      date: dailyWords.date,
      difficulty: dailyWords.difficulty,
      label: words.label,
      attempts: sql<number>`count(${submissions.id})::int`,
      valid: sql<number>`(count(${submissions.id}) filter (where ${isValid}))::int`,
      invalid: sql<number>`(count(${submissions.id}) filter (where ${submissions.status} = 'invalid'))::int`,
      finders: sql<number>`(count(distinct ${submissions.userId}) filter (where ${isValid}))::int`,
      avgInvalidConfidence: sql<number | null>`(avg(${submissions.confidence}) filter (where ${submissions.status} = 'invalid'))::real`,
    })
    .from(dailyWords)
    .innerJoin(words, eq(words.id, dailyWords.wordId))
    .leftJoin(submissions, eq(submissions.dailyWordId, dailyWords.id))
    .where(and(gte(dailyWords.date, from), lte(dailyWords.date, to)))
    .groupBy(dailyWords.id, dailyWords.date, dailyWords.difficulty, words.label)
    .orderBy(asc(dailyWords.date));

  const order = (d: Difficulty) => difficulties.indexOf(d);
  rows.sort((a, b) => a.date.localeCompare(b.date) || order(a.difficulty) - order(b.difficulty));
  return rows.map((r) => {
    const decided = r.valid + r.invalid;
    return {
      ...r,
      passRate: decided ? Math.round((r.valid / decided) * 1000) / 1000 : null,
      avgInvalidConfidence: r.avgInvalidConfidence == null ? null : Math.round(r.avgInvalidConfidence * 1000) / 1000,
    };
  });
}
