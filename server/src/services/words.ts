import { eq, gt, inArray, lte, max, min } from 'drizzle-orm';

import type { Difficulty } from '@shared/types';

import type { Ctx } from '../context';
import { dailyWords, words } from '../db/schema';
import { byDifficulty } from '../domain/enums';
import type { AdminWord, TranslateResult, WordTranslations } from '../dto/admin';
import { SUPPORTED_LOCALES } from '../i18n/locale';
import { HttpError, notFound } from '../lib/errors';
import { logger } from '../lib/logger';
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
      translations: w.translations,
      lastUsed: lastUsed.get(w.id) ?? null,
      nextUse: nextUse.get(w.id) ?? null,
    }));
}

/**
 * Add a word. Any physical object works: Claude judges the photos. Labels are English, stored lower
 * case. Translations are filled in by Claude when it's configured; a failure leaves them for later.
 */
export async function addWord(ctx: Ctx, label: string, difficulty: Difficulty): Promise<void> {
  const clean = label.trim().toLocaleLowerCase('en');
  const inserted = await ctx.db
    .insert(words)
    .values({ label: clean, difficulty })
    .onConflictDoNothing()
    .returning({ id: words.id });
  if (!inserted.length) throw new HttpError(409, 'word_exists', `"${clean}" is already a ${difficulty} word.`);
  if (ctx.translator) await translateWords(ctx, inserted.map((w) => w.id)).catch(() => undefined);
}

const TARGET_LOCALES = SUPPORTED_LOCALES.filter((l) => l !== 'en');

/** Keep only supported languages with non-empty text. */
export function cleanTranslations(input: Record<string, string | undefined>): WordTranslations {
  const out: WordTranslations = {};
  for (const l of TARGET_LOCALES) {
    const v = input[l]?.trim();
    if (v) out[l] = v;
  }
  return out;
}

/**
 * Ask Claude for the languages a word is missing (all words, or just `ids`). Existing translations
 * are kept. One word at a time, so a failure only affects that word.
 */
export async function translateWords(ctx: Ctx, ids?: string[]): Promise<TranslateResult> {
  const translator = ctx.translator;
  if (!translator) {
    throw new HttpError(503, 'translator_unavailable', 'Auto-translate needs ANTHROPIC_API_KEY on the server.');
  }
  const rows = await (ids ? ctx.db.select().from(words).where(inArray(words.id, ids)) : ctx.db.select().from(words));
  const missing = rows.filter((w) => TARGET_LOCALES.some((l) => !w.translations[l]?.trim()));
  let translated = 0;
  const failed: string[] = [];
  for (const w of missing) {
    try {
      const fresh = await translator.translate(w.label);
      await ctx.db
        .update(words)
        .set({ translations: { ...fresh, ...cleanTranslations(w.translations) } })
        .where(eq(words.id, w.id));
      translated++;
    } catch (err) {
      logger.warn({ err, word: w.label }, 'word translation failed');
      failed.push(w.label);
    }
  }
  return { translated, failed };
}

/** Retire/enable a word, or set its own pass threshold (null = the global one). */
export async function updateWord(
  ctx: Ctx,
  id: string,
  patch: { enabled?: boolean; minConfidence?: number | null; translations?: Record<string, string> },
): Promise<void> {
  const { translations, ...rest } = patch;
  const set = { ...rest, ...(translations && { translations: cleanTranslations(translations) }) };
  if (!Object.values(set).some((v) => v !== undefined)) return;
  const [row] = await ctx.db.update(words).set(set).where(eq(words.id, id)).returning({ id: words.id });
  if (!row) throw notFound('Word not found.');
}
