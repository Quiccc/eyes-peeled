import { and, eq, gte, inArray, lte } from 'drizzle-orm';

import type { Difficulty } from '@shared/types';

import type { Ctx } from '../context';
import { dailyWords, words, type WordRow } from '../db/schema';
import { byDifficulty, difficulties } from '../domain/enums';
import { addDays, daysBetween, todayUtc } from '../lib/time';

type TodayWord = {
  dailyWordId: string;
  wordId: string;
  label: string;
  difficulty: Difficulty;
};

const NO_REPEAT_DAYS = 14;

const SPACING_WINDOW_DAYS = 90;

/**
 * A random enabled word of `difficulty` for `date`. Words used within 14 days on either side (future
 * days may already be planned) are avoided. When the pool is too small for that, it picks among the
 * words whose nearest use is furthest away, so repeats are spread as widely as the pool allows.
 * Null if the pool is empty.
 */
export async function pickWord(ctx: Ctx, date: string, difficulty: Difficulty): Promise<WordRow | null> {
  const pool = await ctx.db
    .select()
    .from(words)
    .where(and(eq(words.difficulty, difficulty), eq(words.enabled, true)));
  if (!pool.length) return null;

  const nearby = await ctx.db
    .select({ wordId: dailyWords.wordId, date: dailyWords.date })
    .from(dailyWords)
    .where(
      and(
        gte(dailyWords.date, addDays(date, -SPACING_WINDOW_DAYS)),
        lte(dailyWords.date, addDays(date, SPACING_WINDOW_DAYS)),
      ),
    );
  const gap = new Map<string, number>();
  for (const r of nearby) {
    const days = Math.abs(daysBetween(date, r.date));
    gap.set(r.wordId, Math.min(gap.get(r.wordId) ?? Infinity, days));
  }
  const gapOf = (w: WordRow) => gap.get(w.id) ?? Infinity;

  const fresh = pool.filter((w) => gapOf(w) > NO_REPEAT_DAYS);
  const widest = Math.max(...pool.map(gapOf));
  const choices = fresh.length ? fresh : pool.filter((w) => gapOf(w) === widest);
  return choices[Math.floor(Math.random() * choices.length)] ?? null;
}

/**
 * Today's words, easy -> expert. Days planned in the admin panel are used as they are. A day with
 * missing rows gets them picked on its first request. ON CONFLICT DO NOTHING keeps concurrent first
 * requests safe.
 */
export async function wordsForDate(ctx: Ctx, date = todayUtc(ctx.clock)): Promise<TodayWord[]> {
  let rows = await loadDay(ctx, date);
  if (rows.length < difficulties.length) {
    const have = new Set(rows.map((r) => r.difficulty));
    for (const difficulty of difficulties) {
      if (have.has(difficulty)) continue;
      const pick = await pickWord(ctx, date, difficulty);
      if (!pick) throw new Error(`No enabled words for difficulty "${difficulty}"`);
      await ctx.db.insert(dailyWords).values({ date, difficulty, wordId: pick.id }).onConflictDoNothing();
    }
    rows = await loadDay(ctx, date);
  }
  return rows.sort(byDifficulty);
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
    .where(eq(dailyWords.date, date));
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
    .select({
      id: dailyWords.id,
      date: dailyWords.date,
      difficulty: dailyWords.difficulty,
      label: words.label,
      minConfidence: words.minConfidence,
    })
    .from(dailyWords)
    .innerJoin(words, eq(words.id, dailyWords.wordId))
    .where(eq(dailyWords.id, dailyWordId));
  return row ?? null;
}
