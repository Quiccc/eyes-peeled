import { desc, eq, inArray } from 'drizzle-orm';

import { revokeRefreshTokens } from '../auth/tokens';
import type { Ctx } from '../context';
import { dailyWords, reports, submissions, users, type UserRow } from '../db/schema';
import type { ReportReason, ReportStatus } from '../domain/enums';
import type { AdminReport } from '../dto/admin';
import { notFound } from '../lib/errors';
import { isForeignKeyViolation } from '../lib/sql';
import { recomputeCombos } from './combos';

/** Reports and the actions on them (Apple guideline 1.2: act on reports within 24 hours). */

const REPORTS_LIMIT = 200;

/** A player reports a photo and/or a user. */
export async function fileReport(
  ctx: Ctx,
  reporter: UserRow,
  report: { submissionId?: string; userId?: string; reason: ReportReason },
): Promise<void> {
  try {
    await ctx.db.insert(reports).values({ reporterId: reporter.id, ...report });
  } catch (e) {
    // Unknown submission or user id: nothing to moderate, so accept quietly.
    if (!isForeignKeyViolation(e)) throw e;
  }
}

/** Newest first, with the reported photo and the reported user (named directly, or the photo's owner). */
export async function listReports(ctx: Ctx, status: ReportStatus): Promise<AdminReport[]> {
  const rows = await ctx.db
    .select({ report: reports, submission: submissions })
    .from(reports)
    .leftJoin(submissions, eq(submissions.id, reports.submissionId))
    .where(eq(reports.status, status))
    .orderBy(desc(reports.createdAt))
    .limit(REPORTS_LIMIT);

  const targetOf = (r: (typeof rows)[number]) => r.report.userId ?? r.submission?.userId ?? null;
  const targetIds = [...new Set(rows.map(targetOf).filter((id): id is string => !!id))];
  const targets = targetIds.length
    ? await ctx.db
        .select({ id: users.id, username: users.username, bannedAt: users.bannedAt })
        .from(users)
        .where(inArray(users.id, targetIds))
    : [];
  const byId = new Map(targets.map((u) => [u.id, u]));

  return rows.map((row) => {
    const { report, submission } = row;
    const target = byId.get(targetOf(row) ?? '');
    return {
      ...report,
      createdAt: report.createdAt.toISOString(),
      submission: submission
        ? { id: submission.id, userId: submission.userId, status: submission.status, imageUrl: submission.imageKey ? ctx.storage.signedUrl(submission.imageKey) : null }
        : null,
      target: target ? { ...target, bannedAt: target.bannedAt?.toISOString() ?? null } : null,
    };
  });
}

export async function resolveReport(ctx: Ctx, id: string): Promise<void> {
  await ctx.db.update(reports).set({ status: 'resolved' }).where(eq(reports.id, id));
}

/** Hide a photo: it leaves feeds, and its points (and any combo it made) leave the leaderboard. */
export async function removeSubmission(ctx: Ctx, id: string): Promise<void> {
  const row = await ctx.db.transaction(async (tx) => {
    const [removed] = await tx
      .update(submissions)
      .set({ status: 'removed', points: 0, comboPoints: 0, rank: null })
      .where(eq(submissions.id, id))
      .returning({ imageKey: submissions.imageKey, userId: submissions.userId, dailyWordId: submissions.dailyWordId });
    if (!removed) return null;
    const [day] = await tx.select({ date: dailyWords.date }).from(dailyWords).where(eq(dailyWords.id, removed.dailyWordId));
    if (day) await recomputeCombos(tx, removed.userId, day.date);
    return removed;
  });
  if (!row) throw notFound('Submission not found.');
  if (row.imageKey) await ctx.storage.delete(row.imageKey);
}

/** Ban: blocks sign-in and API access, hides the user everywhere. */
export async function banUser(ctx: Ctx, id: string): Promise<void> {
  const [row] = await ctx.db.update(users).set({ bannedAt: ctx.clock.now() }).where(eq(users.id, id)).returning({ id: users.id });
  if (!row) throw notFound('User not found.');
  await revokeRefreshTokens(ctx, id);
}

export async function unbanUser(ctx: Ctx, id: string): Promise<void> {
  const [row] = await ctx.db.update(users).set({ bannedAt: null }).where(eq(users.id, id)).returning({ id: users.id });
  if (!row) throw notFound('User not found.');
}
