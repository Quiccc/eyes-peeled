import { and, eq, gte, lte } from 'drizzle-orm';

import type { Difficulty } from '@shared/types';

import type { Ctx } from '../context';
import { dailyWords, words } from '../db/schema';
import { difficulties } from '../domain/enums';
import type { MonthSchedule, ScheduleDay } from '../dto/admin';
import { badRequest, notFound } from '../lib/errors';
import { addDays, nextMonthStartUtc, todayUtc, utcMonth } from '../lib/time';
import { pickWord } from './daily-words';

/** The calendar of daily words, planned a month at a time in the admin panel (Schedule page). */

/** Every date of a YYYY-MM month (already validated). */
function monthDays(month: string): string[] {
  const days: string[] = [];
  for (let d = `${month}-01`; d.startsWith(month); d = addDays(d, 1)) days.push(d);
  return days;
}

export async function getSchedule(ctx: Ctx, month: string): Promise<MonthSchedule> {
  const days = monthDays(month);
  const rows = await ctx.db
    .select({
      dailyWordId: dailyWords.id,
      date: dailyWords.date,
      difficulty: dailyWords.difficulty,
      wordId: words.id,
      label: words.label,
    })
    .from(dailyWords)
    .innerJoin(words, eq(words.id, dailyWords.wordId))
    .where(and(gte(dailyWords.date, days[0]!), lte(dailyWords.date, days[days.length - 1]!)));

  const byDay = new Map<string, ScheduleDay>(
    days.map((date) => [date, { date, words: { easy: null, medium: null, hard: null, expert: null } }]),
  );
  for (const r of rows) {
    byDay.get(r.date)!.words[r.difficulty] = { dailyWordId: r.dailyWordId, wordId: r.wordId, label: r.label };
  }
  return { month, today: todayUtc(ctx.clock), days: [...byDay.values()] };
}

/**
 * Fill every empty slot of `month` from today on. Never overwrites a planned day. Picks only enabled
 * words, avoiding repeats within 14 days. Returns how many slots were filled.
 */
export async function fillMonth(ctx: Ctx, month: string): Promise<{ filled: number; schedule: MonthSchedule }> {
  const today = todayUtc(ctx.clock);
  const before = await getSchedule(ctx, month);
  let filled = 0;
  for (const day of before.days) {
    if (day.date < today) continue;
    for (const difficulty of difficulties) {
      if (day.words[difficulty]) continue;
      const pick = await pickWord(ctx, day.date, difficulty);
      if (!pick) throw badRequest(`No enabled ${difficulty} words. Add or enable some first.`);
      const inserted = await ctx.db
        .insert(dailyWords)
        .values({ date: day.date, difficulty, wordId: pick.id })
        .onConflictDoNothing()
        .returning({ id: dailyWords.id });
      filled += inserted.length;
    }
  }
  return { filled, schedule: await getSchedule(ctx, month) };
}

/** Change one future day's word. Today and past days are locked: players may already have played them. */
export async function setDay(ctx: Ctx, date: string, difficulty: Difficulty, wordId: string): Promise<void> {
  if (date <= todayUtc(ctx.clock)) throw badRequest("Today's and past words can't be changed.");
  const [word] = await ctx.db.select().from(words).where(eq(words.id, wordId));
  if (!word) throw notFound('Word not found.');
  if (word.difficulty !== difficulty) throw badRequest(`"${word.label}" is a ${word.difficulty} word, not ${difficulty}.`);
  if (!word.enabled) throw badRequest(`"${word.label}" is retired. Enable it first.`);

  await ctx.db
    .insert(dailyWords)
    .values({ date, difficulty, wordId })
    .onConflictDoUpdate({ target: [dailyWords.date, dailyWords.difficulty], set: { wordId } });
}

/**
 * AUTO_SCHEDULE: during the 1st-7th of each month, fill next month's empty days. Returns the number of
 * slots filled. Safe to call often: planned days are never changed.
 */
export async function autoSchedule(ctx: Ctx): Promise<number> {
  const now = ctx.clock.now();
  if (now.getUTCDate() > 7) return 0;
  return (await fillMonth(ctx, utcMonth(nextMonthStartUtc(now)))).filled;
}
