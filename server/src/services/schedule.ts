import { and, asc, eq, gt, gte, lte, max, min } from 'drizzle-orm';

import type { Difficulty } from '@shared/types';

import type { Ctx } from '../context';
import { dailyWords, difficulties, words } from '../db/schema';
import { HttpError, notFound } from '../lib/errors';
import { addDays, utcDate } from '../lib/time';
import { pickWord } from './daily-words';

export type ScheduledWord = { dailyWordId: string; wordId: string; label: string };
export type ScheduleDay = { date: string; words: Record<Difficulty, ScheduledWord | null> };
export type MonthSchedule = { month: string; today: string; days: ScheduleDay[] };

export type AdminWord = {
  id: string;
  label: string;
  difficulty: Difficulty;
  enabled: boolean;
  minConfidence: number | null;
  /** null when no YOLO service is configured, so it can't be checked */
  knownByModel: boolean | null;
  lastUsed: string | null;
  nextUse: string | null;
};

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export function monthDays(month: string): string[] {
  if (!MONTH.test(month)) throw new HttpError(400, 'bad_request', 'Month must look like 2026-12.');
  const days: string[] = [];
  for (let d = `${month}-01`; d.startsWith(month); d = addDays(d, 1)) days.push(d);
  return days;
}

/**
 * Labels the running model knows (lower case), or null when there's no YOLO service to ask.
 * A configured service that can't be reached is an error: scheduling blind could pick words the
 * model can't judge.
 */
export async function knownLabels(ctx: Ctx): Promise<Set<string> | null> {
  try {
    return await ctx.model.classes();
  } catch (e) {
    console.error('model classes failed', e);
    throw new HttpError(503, 'model_unavailable', "Can't reach the YOLO service to check which words it knows. Try again in a moment.");
  }
}

function assertKnown(known: Set<string> | null, label: string) {
  if (known && !known.has(label.toLowerCase())) {
    throw new HttpError(400, 'bad_request', `The model doesn't know "${label}". Train it on that word first.`);
  }
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
  return { month, today: utcDate(ctx.clock.now()), days: [...byDay.values()] };
}

/**
 * Fill every empty slot of `month` from today on. Never overwrites a planned day. Picks only enabled
 * words the model knows, avoiding repeats within 14 days. Returns how many slots were filled.
 */
export async function fillMonth(ctx: Ctx, month: string): Promise<{ filled: number; schedule: MonthSchedule }> {
  const today = utcDate(ctx.clock.now());
  const known = await knownLabels(ctx);
  const allowed = known ? (label: string) => known.has(label.toLowerCase()) : undefined;
  const before = await getSchedule(ctx, month);
  let filled = 0;
  for (const day of before.days) {
    if (day.date < today) continue;
    for (const difficulty of difficulties) {
      if (day.words[difficulty]) continue;
      const pick = await pickWord(ctx, day.date, difficulty, allowed);
      if (!pick) {
        throw new HttpError(400, 'bad_request', `No enabled ${difficulty} words the model knows. Add or enable some first.`);
      }
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
  const today = utcDate(ctx.clock.now());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, 'bad_request', 'Date must look like 2026-12-01.');
  if (date <= today) throw new HttpError(400, 'bad_request', "Today's and past words can't be changed.");
  const [word] = await ctx.db.select().from(words).where(eq(words.id, wordId));
  if (!word) throw notFound('Word not found.');
  if (word.difficulty !== difficulty) {
    throw new HttpError(400, 'bad_request', `"${word.label}" is a ${word.difficulty} word, not ${difficulty}.`);
  }
  if (!word.enabled) throw new HttpError(400, 'bad_request', `"${word.label}" is retired. Enable it first.`);
  assertKnown(await knownLabels(ctx), word.label);

  await ctx.db
    .insert(dailyWords)
    .values({ date, difficulty, wordId })
    .onConflictDoUpdate({ target: [dailyWords.date, dailyWords.difficulty], set: { wordId } });
}

export async function listWords(ctx: Ctx): Promise<AdminWord[]> {
  const today = utcDate(ctx.clock.now());
  const [known, rows, past, future] = await Promise.all([
    knownLabels(ctx).catch(() => null),
    ctx.db.select().from(words).orderBy(asc(words.difficulty), asc(words.label)),
    ctx.db
      .select({ wordId: dailyWords.wordId, at: max(dailyWords.date) })
      .from(dailyWords)
      .where(lte(dailyWords.date, today))
      .groupBy(dailyWords.wordId),
    ctx.db
      .select({ wordId: dailyWords.wordId, at: min(dailyWords.date) })
      .from(dailyWords)
      .where(gt(dailyWords.date, today))
      .groupBy(dailyWords.wordId),
  ]);
  const lastUsed = new Map(past.map((r) => [r.wordId, r.at]));
  const nextUse = new Map(future.map((r) => [r.wordId, r.at]));
  const order = (d: Difficulty) => difficulties.indexOf(d);
  return rows
    .sort((a, b) => order(a.difficulty) - order(b.difficulty) || a.label.localeCompare(b.label))
    .map((w) => ({
      id: w.id,
      label: w.label,
      difficulty: w.difficulty,
      enabled: w.enabled,
      minConfidence: w.minConfidence,
      knownByModel: known ? known.has(w.label.toLowerCase()) : null,
      lastUsed: lastUsed.get(w.id) ?? null,
      nextUse: nextUse.get(w.id) ?? null,
    }));
}

export async function addWord(ctx: Ctx, label: string, difficulty: Difficulty): Promise<void> {
  const clean = label.trim().toLowerCase();
  assertKnown(await knownLabels(ctx), clean);
  const inserted = await ctx.db
    .insert(words)
    .values({ label: clean, difficulty })
    .onConflictDoNothing()
    .returning({ id: words.id });
  if (!inserted.length) throw new HttpError(409, 'word_exists', `"${clean}" is already a ${difficulty} word.`);
}

export async function updateWord(
  ctx: Ctx,
  id: string,
  patch: { enabled?: boolean; minConfidence?: number | null },
): Promise<void> {
  if (patch.enabled === undefined && patch.minConfidence === undefined) return;
  const [row] = await ctx.db.update(words).set(patch).where(eq(words.id, id)).returning({ id: words.id });
  if (!row) throw notFound('Word not found.');
}

/**
 * AUTO_SCHEDULE: during the 1st-7th of each month, fill next month's empty days. Returns the number of
 * slots filled. Safe to call often: planned days are never changed.
 */
export async function autoSchedule(ctx: Ctx): Promise<number> {
  const now = ctx.clock.now();
  if (now.getUTCDate() > 7) return 0;
  const next = utcDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))).slice(0, 7);
  return (await fillMonth(ctx, next)).filled;
}

/** Enabled words the running model doesn't know. Empty when there's no YOLO service. */
export async function wordsUnknownToModel(ctx: Ctx): Promise<string[]> {
  const known = await ctx.model.classes();
  if (!known) return [];
  const enabled = await ctx.db.select({ label: words.label }).from(words).where(eq(words.enabled, true));
  return [...new Set(enabled.map((w) => w.label))].filter((l) => !known.has(l.toLowerCase())).sort();
}
