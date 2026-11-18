import { createHash, randomUUID } from 'node:crypto';

import { and, count, countDistinct, eq, inArray, min, notInArray } from 'drizzle-orm';

import type { Daily, DailyWord, Submission } from '@shared/types';

import type { Ctx } from '../context';
import { submissions, type SubmissionRow, type UserRow } from '../db/schema';
import { HttpError, notFound } from '../lib/errors';
import { isUniqueViolation } from '../lib/sql';
import { toSubmission } from '../lib/present';
import { existingId } from '../lib/validation';
import { nextDayStartUtc, utcDate } from '../lib/time';
import { wordsForDate } from './daily-words';
import { MAX_POINTS } from './scoring';
import { decide } from './verification';

const MAX_ATTEMPTS_PER_WORD = 10;
/** Photos waiting for a verdict across all players. Each holds its buffer (up to 3.75 MB) in memory. */
export const MAX_QUEUED_CHECKS = 50;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const wordGone = () => new HttpError(404, 'word_not_found', 'This word is no longer active.');
const stillPending = () =>
  new HttpError(409, 'submission_pending', "We're still checking your last photo for this word.");

// ---- GET /daily ---------------------------------------------------------------

export async function getDaily(ctx: Ctx, user: UserRow): Promise<Daily> {
  const now = ctx.clock.now();
  const all = await wordsForDate(ctx);
  const visible = all.filter((w) => w.difficulty !== 'expert' || user.isPremium);
  const ids = visible.map((w) => w.dailyWordId);

  const found = await ctx.db
    .select({
      dailyWordId: submissions.dailyWordId,
      n: countDistinct(submissions.userId),
      firstAt: min(submissions.receivedAt),
    })
    .from(submissions)
    .where(and(inArray(submissions.dailyWordId, ids), eq(submissions.status, 'valid')))
    .groupBy(submissions.dailyWordId);
  const foundCount = new Map(found.map((f) => [f.dailyWordId, f.n]));
  const firstFoundAt = new Map(
    found.map((f) => [f.dailyWordId, f.firstAt ? new Date(f.firstAt).toISOString() : null]),
  );

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
      firstFoundAt: firstFoundAt.get(w.dailyWordId) ?? null,
      status: valid ? 'found' : pending ? 'pending' : 'open',
      submission: sub ? toSubmission(sub, ctx.storage) : null,
    };
  });

  return { date: utcDate(now), nextResetAt: nextDayStartUtc(now).toISOString(), words };
}

// ---- POST /words/:wordId/submissions -----------------------------------------

export async function createSubmission(ctx: Ctx, user: UserRow, rawWordId: string, photo: Buffer): Promise<Submission> {
  // The receipt time decides the score, so take it before any slow work.
  const receivedAt = ctx.clock.now();
  const dailyWordId = existingId(rawWordId, wordGone);

  const today = await wordsForDate(ctx, utcDate(receivedAt));
  const word = today.find((w) => w.dailyWordId === dailyWordId);
  if (!word) throw wordGone();
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
  if (existing.some((s) => s.status === 'pending')) throw stillPending();
  // Photos the verifier couldn't check (status 'error') don't use up a try.
  const tries = existing.filter((s) => s.status !== 'error').length;
  if (tries >= MAX_ATTEMPTS_PER_WORD) {
    throw new HttpError(
      429,
      'rate_limited',
      `That's ${MAX_ATTEMPTS_PER_WORD} tries for this word today. New words arrive at midnight UTC!`,
    );
  }

  if (ctx.queue.size() >= MAX_QUEUED_CHECKS) {
    throw new HttpError(429, 'rate_limited', 'Lots of photos are being checked right now. Try again in a minute.');
  }

  const sha = createHash('sha256').update(photo).digest('hex');
  const id = randomUUID();

  // Exact re-uploads (your own or someone else's photo) never count, and aren't stored. A photo the
  // verifier couldn't check may be sent again.
  const [dupe] = await ctx.db
    .select({ n: count() })
    .from(submissions)
    .where(and(eq(submissions.imageSha256, sha), notInArray(submissions.status, ['removed', 'error'])));
  const isDupe = (dupe?.n ?? 0) > 0;

  const imageKey = isDupe ? null : `${user.id}/${id}.jpg`;
  if (imageKey) await ctx.storage.put(imageKey, photo);

  // The SELECT above can race with a parallel upload; submissions_one_pending_idx settles it.
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
    .returning()
    .catch(async (e: unknown) => {
      if (!isUniqueViolation(e)) throw e;
      if (imageKey) await ctx.storage.delete(imageKey);
      throw stillPending();
    });
  if (!row) throw new Error('insert failed');
  if (isDupe) return toSubmission(row, ctx.storage);

  // Verify in the background; answer with the verdict if it's quick, otherwise 'pending'.
  const done = ctx.queue.run(id, () => decide(ctx, id, photo));
  await Promise.race([done, sleep(ctx.env.VERIFY_SYNC_WAIT_MS)]);
  return getSubmissionFor(ctx, user, id);
}

// ---- GET /submissions/:id -------------------------------------------------------

export async function getSubmissionFor(ctx: Ctx, user: UserRow, id: string): Promise<Submission> {
  const row = await ownSubmission(ctx, user, id);
  return toSubmission(row, ctx.storage);
}

async function ownSubmission(ctx: Ctx, user: UserRow, rawId: string): Promise<SubmissionRow> {
  const id = existingId(rawId, () => notFound('Submission not found.'));
  const [row] = await ctx.db
    .select()
    .from(submissions)
    .where(and(eq(submissions.id, id), eq(submissions.userId, user.id)));
  if (!row) throw notFound('Submission not found.');
  return row;
}
