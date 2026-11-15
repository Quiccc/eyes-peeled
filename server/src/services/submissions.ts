import { createHash, randomUUID } from 'node:crypto';

import { and, count, countDistinct, eq, gte, inArray, lt, ne } from 'drizzle-orm';

import type { Daily, DailyWord, Submission } from '@shared/types';

import type { Ctx } from '../context';
import { dailyWords, submissions, type SubmissionRow, type UserRow } from '../db/schema';
import { HttpError, notFound } from '../lib/errors';
import { toSubmission } from '../lib/present';
import { isUniqueViolation } from '../lib/sql';
import { dayStartUtc, nextDayStartUtc, utcDate } from '../lib/time';

import { dailyWordById, wordsForDate } from './daily-words';
import { MAX_POINTS, pointsFor } from './scoring';

export const MAX_ATTEMPTS_PER_WORD = 10;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---- GET /daily ---------------------------------------------------------------

export async function getDaily(ctx: Ctx, user: UserRow): Promise<Daily> {
  const now = ctx.clock.now();
  const all = await wordsForDate(ctx);
  const visible = all.filter((w) => w.difficulty !== 'expert' || user.isPremium);
  const ids = visible.map((w) => w.dailyWordId);

  const found = await ctx.db
    .select({ dailyWordId: submissions.dailyWordId, n: countDistinct(submissions.userId) })
    .from(submissions)
    .where(and(inArray(submissions.dailyWordId, ids), eq(submissions.status, 'valid')))
    .groupBy(submissions.dailyWordId);
  const foundCount = new Map(found.map((f) => [f.dailyWordId, f.n]));

  const mine = await ctx.db
    .select()
    .from(submissions)
    .where(
      and(
        eq(submissions.userId, user.id),
        inArray(submissions.dailyWordId, ids),
        inArray(submissions.status, ['valid', 'pending']),
      ),
    );

  const words: DailyWord[] = visible.map((w) => {
    const valid = mine.find((s) => s.dailyWordId === w.dailyWordId && s.status === 'valid');
    const pending = valid ? undefined : mine.find((s) => s.dailyWordId === w.dailyWordId && s.status === 'pending');
    const sub = valid ?? pending;
    return {
      id: w.dailyWordId,
      difficulty: w.difficulty,
      word: w.label,
      maxPoints: MAX_POINTS[w.difficulty],
      foundCount: foundCount.get(w.dailyWordId) ?? 0,
      status: valid ? 'found' : pending ? 'pending' : 'open',
      submission: sub ? toSubmission(sub, w.dailyWordId, ctx.storage) : null,
    };
  });

  return { date: utcDate(now), nextResetAt: nextDayStartUtc(now).toISOString(), words };
}

// ---- POST /words/:wordId/submissions -----------------------------------------

export async function createSubmission(ctx: Ctx, user: UserRow, dailyWordId: string, photo: Buffer): Promise<Submission> {
  // The receipt time decides the score, so take it before any slow work.
  const receivedAt = ctx.clock.now();

  const today = await wordsForDate(ctx, utcDate(receivedAt));
  const word = today.find((w) => w.dailyWordId === dailyWordId);
  if (!word) throw new HttpError(404, 'word_not_found', 'This word is no longer active.');
  if (word.difficulty === 'expert' && !user.isPremium) {
    throw new HttpError(403, 'premium_required', 'The Premium word is part of Premium.');
  }

  const existing = await ctx.db
    .select({ status: submissions.status })
    .from(submissions)
    .where(and(eq(submissions.userId, user.id), eq(submissions.dailyWordId, dailyWordId)));
  if (existing.some((s) => s.status === 'valid')) {
    throw new HttpError(409, 'already_found', 'You already found this one today.');
  }
  if (existing.some((s) => s.status === 'pending')) {
    throw new HttpError(409, 'submission_pending', "We're still checking your last photo for this word.");
  }
  if (existing.length >= MAX_ATTEMPTS_PER_WORD) {
    throw new HttpError(
      429,
      'rate_limited',
      `That's ${MAX_ATTEMPTS_PER_WORD} tries for this word today. New words arrive at midnight UTC!`,
    );
  }

  const sha = createHash('sha256').update(photo).digest('hex');
  const id = randomUUID();
  const imageKey = `${user.id}/${id}.jpg`;
  await ctx.storage.put(imageKey, photo);

  // Exact re-uploads (your own or someone else's photo) never count.
  const [dupe] = await ctx.db
    .select({ n: count() })
    .from(submissions)
    .where(and(eq(submissions.imageSha256, sha), ne(submissions.status, 'removed')));
  const isDupe = (dupe?.n ?? 0) > 0;

  const [row] = await ctx.db
    .insert(submissions)
    .values({
      id,
      userId: user.id,
      dailyWordId,
      status: isDupe ? 'invalid' : 'pending',
      message: isDupe ? "We've seen this exact photo before. Snap a fresh one!" : null,
      imageKey,
      imageSha256: sha,
      receivedAt,
      decidedAt: isDupe ? receivedAt : null,
    })
    .returning();
  if (!row) throw new Error('insert failed');
  if (isDupe) return toSubmission(row, dailyWordId, ctx.storage);

  // Verify in the background; answer with the verdict if it's quick, otherwise 'pending'.
  const done = ctx.queue.run(id, () => decide(ctx, id, photo));
  await Promise.race([done, sleep(ctx.env.VERIFY_SYNC_WAIT_MS)]);
  return getSubmissionFor(ctx, user, id);
}

/** Run the verifier on a pending submission and record the verdict. */
export async function decide(ctx: Ctx, submissionId: string, photo?: Buffer): Promise<void> {
  const [sub] = await ctx.db.select().from(submissions).where(eq(submissions.id, submissionId));
  if (!sub || sub.status !== 'pending') return;
  const word = await dailyWordById(ctx, sub.dailyWordId);
  if (!word) return;

  let verdict;
  try {
    const image = photo ?? (await ctx.storage.read(sub.imageKey));
    verdict = await ctx.verifier.verify(image, word.label);
  } catch (e) {
    console.error('verifier failed', e);
    await ctx.db
      .update(submissions)
      .set({
        status: 'invalid',
        message: "We couldn't check your photo right now. Please try again in a moment.",
        decidedAt: ctx.clock.now(),
      })
      .where(and(eq(submissions.id, submissionId), eq(submissions.status, 'pending')));
    return;
  }

  const threshold = word.minConfidence ?? ctx.env.YOLO_MIN_CONFIDENCE;
  const passed = verdict.detected && (verdict.confidence ?? 1) >= threshold;
  if (!passed) {
    await ctx.db
      .update(submissions)
      .set({
        status: 'invalid',
        confidence: verdict.confidence,
        message: `We couldn't spot a ${word.label}. Get closer and make sure it's in focus.`,
        decidedAt: ctx.clock.now(),
      })
      .where(and(eq(submissions.id, submissionId), eq(submissions.status, 'pending')));
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

// ---- GET /submissions/:id -------------------------------------------------------

export async function getSubmissionFor(ctx: Ctx, user: UserRow, id: string): Promise<Submission> {
  const row = await ownSubmission(ctx, user, id);
  return toSubmission(row, row.dailyWordId, ctx.storage);
}

async function ownSubmission(ctx: Ctx, user: UserRow, id: string): Promise<SubmissionRow> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw notFound('Submission not found.');
  const [row] = await ctx.db
    .select()
    .from(submissions)
    .where(and(eq(submissions.id, id), eq(submissions.userId, user.id)));
  if (!row) throw notFound('Submission not found.');
  return row;
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

/** Valid submissions of `userIds` received today (UTC). */
export function validToday(ctx: Ctx, userIds: string[]) {
  const now = ctx.clock.now();
  if (!userIds.length) return Promise.resolve([] as SubmissionRow[]);
  return ctx.db
    .select()
    .from(submissions)
    .where(
      and(
        inArray(submissions.userId, userIds),
        eq(submissions.status, 'valid'),
        gte(submissions.receivedAt, dayStartUtc(now)),
        lt(submissions.receivedAt, nextDayStartUtc(now)),
      ),
    );
}
