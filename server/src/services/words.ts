import { eq, gt, lte, max, min } from 'drizzle-orm';

import type { Difficulty } from '@shared/types';

import type { Ctx } from '../context';
import { dailyWords, words } from '../db/schema';
import { byDifficulty } from '../domain/enums';
import type { AdminWord } from '../dto/admin';
import { HttpError, notFound } from '../lib/errors';
import { todayUtc } from '../lib/time';

/** The word catalogue managed in the admin panel (Words page). */

export async function listWords(ctx: Ctx): Promise<AdminWord[]> {
  const today = todayUtc(ctx.clock);
  const [rows, past, future] = await Promise.all([
    ctx.db.select().from(words),
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
  return rows
    .sort((a, b) => byDifficulty(a, b) || a.label.localeCompare(b.label))
    .map((w) => ({
      id: w.id,
      label: w.label,
      difficulty: w.difficulty,
      enabled: w.enabled,
      minConfidence: w.minConfidence,
      lastUsed: lastUsed.get(w.id) ?? null,
      nextUse: nextUse.get(w.id) ?? null,
    }));
}

/** Add a word. Any physical object works: Claude judges the photos. Labels are stored lower case. */
export async function addWord(ctx: Ctx, label: string, difficulty: Difficulty): Promise<void> {
  const clean = label.trim().toLowerCase();
  const inserted = await ctx.db
    .insert(words)
    .values({ label: clean, difficulty })
    .onConflictDoNothing()
    .returning({ id: words.id });
  if (!inserted.length) throw new HttpError(409, 'word_exists', `"${clean}" is already a ${difficulty} word.`);
}

/** Retire/enable a word, or set its own pass threshold (null = the global one). */
export async function updateWord(
  ctx: Ctx,
  id: string,
  patch: { enabled?: boolean; minConfidence?: number | null },
): Promise<void> {
  if (patch.enabled === undefined && patch.minConfidence === undefined) return;
  const [row] = await ctx.db.update(words).set(patch).where(eq(words.id, id)).returning({ id: words.id });
  if (!row) throw notFound('Word not found.');
}
