import { and, asc, eq, gte, lte, sql } from 'drizzle-orm';

import type { Ctx } from '../context';
import { dailyWords, submissions, words } from '../db/schema';
import { byDifficulty } from '../domain/enums';
import type { WordDayStats } from '../dto/admin';
import { badRequest } from '../lib/errors';
import { addDays, todayUtc } from '../lib/time';

const MAX_RANGE_DAYS = 120;

/** Per daily word in [from, to] (validated YYYY-MM-DD). Defaults to the last 30 days. Removed photos count as valid finds. */
export async function wordStats(ctx: Ctx, range: { from?: string; to?: string }): Promise<WordDayStats[]> {
  const to = range.to ?? todayUtc(ctx.clock);
  const from = range.from ?? addDays(to, -29);
  if (from > to) throw badRequest('"from" must be on or before "to".');
  if (addDays(from, MAX_RANGE_DAYS) < to) throw badRequest(`Pick at most ${MAX_RANGE_DAYS} days.`);

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

  rows.sort((a, b) => a.date.localeCompare(b.date) || byDifficulty(a, b));
  return rows.map((r) => {
    const decided = r.valid + r.invalid;
    return {
      ...r,
      passRate: decided ? Math.round((r.valid / decided) * 1000) / 1000 : null,
      avgInvalidConfidence: r.avgInvalidConfidence == null ? null : Math.round(r.avgInvalidConfidence * 1000) / 1000,
    };
  });
}
