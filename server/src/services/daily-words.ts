import { and, asc, eq, gte, inArray } from 'drizzle-orm';

import type { Difficulty } from '@shared/types';

import type { Ctx } from '../context';
import { dailyWords, difficulties, words } from '../db/schema';
import { addDays, utcDate } from '../lib/time';

export type TodayWord = {
  dailyWordId: string;
  wordId: string;
  label: string;
  difficulty: Difficulty;
};

const NO_REPEAT_DAYS = 14;

/**
 * Today's words, easy -> expert. Picks them on the first request of the UTC day; skips
 * words used in the last 14 days. ON CONFLICT DO NOTHING keeps concurrent first requests safe.
 */
export async function wordsForDate(ctx: Ctx, date = utcDate(ctx.clock.now())): Promise<TodayWord[]> {
  let rows = await loadDay(ctx, date);
  if (rows.length < difficulties.length) {
    const have = new Set(rows.map((r) => r.difficulty));
    const recent = await ctx.db
      .select({ wordId: dailyWords.wordId })
      .from(dailyWords)
      .where(gte(dailyWords.date, addDays(date, -NO_REPEAT_DAYS)));
    const recentIds = new Set(recent.map((r) => r.wordId));
    for (const difficulty of difficulties) {
      if (have.has(difficulty)) continue;
      const pool = await ctx.db.select().from(words).where(eq(words.difficulty, difficulty));
      const fresh = pool.filter((w) => !recentIds.has(w.id));
      const choices = fresh.length ? fresh : pool;
      const pick = choices[Math.floor(Math.random() * choices.length)];
      if (!pick) throw new Error(`No words seeded for difficulty "${difficulty}"`);
      await ctx.db.insert(dailyWords).values({ date, difficulty, wordId: pick.id }).onConflictDoNothing();
    }
    rows = await loadDay(ctx, date);
  }
  const order = (d: Difficulty) => difficulties.indexOf(d);
  return rows.sort((a, b) => order(a.difficulty) - order(b.difficulty));
}

function loadDay(ctx: Ctx, date: string): Promise<TodayWord[]> {
  return ctx.db
    .select({
      dailyWordId: dailyWords.id,
      wordId: words.id,
      label: words.label,
      difficulty: dailyWords.difficulty,
    })
    .from(dailyWords)
    .innerJoin(words, eq(words.id, dailyWords.wordId))
    .where(eq(dailyWords.date, date))
    .orderBy(asc(dailyWords.difficulty));
}

/** Label + difficulty for a set of daily word ids (for feeds and profiles). */
export async function dailyWordInfo(ctx: Ctx, dailyWordIds: string[]) {
  if (!dailyWordIds.length) return new Map<string, { label: string; difficulty: Difficulty; date: string }>();
  const rows = await ctx.db
    .select({ id: dailyWords.id, label: words.label, difficulty: dailyWords.difficulty, date: dailyWords.date })
    .from(dailyWords)
    .innerJoin(words, eq(words.id, dailyWords.wordId))
    .where(inArray(dailyWords.id, dailyWordIds));
  return new Map(rows.map((r) => [r.id, r]));
}

export async function dailyWordById(ctx: Ctx, dailyWordId: string) {
  const [row] = await ctx.db
    .select({ id: dailyWords.id, date: dailyWords.date, difficulty: dailyWords.difficulty, label: words.label })
    .from(dailyWords)
    .innerJoin(words, eq(words.id, dailyWords.wordId))
    .where(and(eq(dailyWords.id, dailyWordId)));
  return row ?? null;
}
