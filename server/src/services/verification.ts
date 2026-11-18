import { and, count, eq } from 'drizzle-orm';

import type { Ctx } from '../context';
import { dailyWords, submissions } from '../db/schema';
import { logger } from '../lib/logger';
import { isUniqueViolation } from '../lib/sql';
import { creditCombo } from './combos';
import { dailyWordById } from './daily-words';
import { pointsFor } from './scoring';
import type { Verdict } from './verifier';

/** The verdict worker: runs the verifier on pending photos (through ctx.queue) and records the result. */

/** Reject a still-pending submission with a message for the player. */
async function markInvalid(ctx: Ctx, submissionId: string, message: string, confidence?: number | null) {
  await ctx.db
    .update(submissions)
    .set({ status: 'invalid', message, ...(confidence !== undefined && { confidence }), decidedAt: ctx.clock.now() })
    .where(and(eq(submissions.id, submissionId), eq(submissions.status, 'pending')));
}

/** The verifier failed (outage, timeout). The photo wasn't judged, so it doesn't cost the player a try. */
async function markError(ctx: Ctx, submissionId: string) {
  await ctx.db
    .update(submissions)
    .set({ status: 'error', message: "We couldn't check your photo right now. Please try again in a moment.", decidedAt: ctx.clock.now() })
    .where(and(eq(submissions.id, submissionId), eq(submissions.status, 'pending')));
}

/**
 * Does the verdict count? The word's own threshold wins over VERIFY_MIN_CONFIDENCE.
 * A detection without a confidence passes.
 */
function passes(verdict: Verdict, threshold: number) {
  return verdict.detected && (verdict.confidence ?? 1) >= threshold;
}

/** Run the verifier on a pending submission and record the verdict. */
export async function decide(ctx: Ctx, submissionId: string, photo?: Buffer): Promise<void> {
  const [sub] = await ctx.db.select().from(submissions).where(eq(submissions.id, submissionId));
  if (!sub || sub.status !== 'pending') return;
  const word = await dailyWordById(ctx, sub.dailyWordId);
  if (!word) return;

  let verdict: Verdict;
  try {
    if (!photo && !sub.imageKey) throw new Error(`submission ${sub.id} has no stored photo`);
    const image = photo ?? (await ctx.storage.read(sub.imageKey!));
    verdict = await ctx.verifier.verify(image, word.label);
  } catch (e) {
    logger.error({ err: e, submissionId }, 'verifier failed');
    await markError(ctx, submissionId);
    return;
  }

  logger.info(
    { submissionId, word: word.label, detected: verdict.detected, confidence: verdict.confidence, reason: verdict.reason },
    'verdict',
  );

  if (!passes(verdict, word.minConfidence ?? ctx.env.VERIFY_MIN_CONFIDENCE)) {
    await markInvalid(
      ctx,
      submissionId,
      `We couldn't spot a ${word.label}. Get closer and make sure it's in focus.`,
      verdict.confidence,
    );
    return;
  }

  try {
    await ctx.db.transaction(async (tx) => {
      // Lock the word so concurrent verdicts get distinct ranks.
      await tx.select({ id: dailyWords.id }).from(dailyWords).where(eq(dailyWords.id, sub.dailyWordId)).for('update');
      const [before] = await tx
        .select({ n: count() })
        .from(submissions)
        .where(and(eq(submissions.dailyWordId, sub.dailyWordId), eq(submissions.status, 'valid')));
      await tx
        .update(submissions)
        .set({
          status: 'valid',
          confidence: verdict.confidence,
          points: pointsFor(word.difficulty, sub.receivedAt),
          rank: (before?.n ?? 0) + 1,
          message: null,
          decidedAt: ctx.clock.now(),
        })
        .where(and(eq(submissions.id, submissionId), eq(submissions.status, 'pending')));
      await creditCombo(tx, sub.userId, word.date, submissionId);
    });
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    // Already has a valid find for this word (shouldn't happen: new uploads are blocked while pending).
    await ctx.db
      .update(submissions)
      .set({ status: 'invalid', message: 'You already found this one today.', decidedAt: ctx.clock.now() })
      .where(eq(submissions.id, submissionId));
  }
}

/** Re-queue submissions left 'pending' by a restart. Call once at startup. */
export async function requeuePending(ctx: Ctx): Promise<number> {
  const pending = await ctx.db
    .select({ id: submissions.id })
    .from(submissions)
    .where(eq(submissions.status, 'pending'));
  for (const p of pending) void ctx.queue.run(p.id, () => decide(ctx, p.id));
  return pending.length;
}
