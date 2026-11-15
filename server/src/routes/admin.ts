import { timingSafeEqual } from 'node:crypto';

import { desc, eq } from 'drizzle-orm';
import { Router, type RequestHandler } from 'express';
import { z } from 'zod';

import { revokeRefreshTokens } from '../auth/tokens';
import type { Ctx } from '../context';
import { reports, submissions, users } from '../db/schema';
import { HttpError, notFound } from '../lib/errors';
import { handleWebhook } from '../services/revenuecat';

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Bearer ADMIN_TOKEN. Admin routes are off when it isn't set. */
function requireAdmin(ctx: Ctx): RequestHandler {
  return (req, _res, next) => {
    const token = ctx.env.ADMIN_TOKEN;
    if (!token || !safeEqual(req.get('authorization') ?? '', `Bearer ${token}`)) {
      throw new HttpError(404, 'not_found', 'Not found.');
    }
    next();
  };
}

/** Moderation (Apple guideline 1.2) and the RevenueCat webhook. */
export function adminRoutes(ctx: Ctx) {
  const r = Router();

  r.post('/webhooks/revenuecat', async (req, res) => {
    const expected = ctx.env.REVENUECAT_WEBHOOK_AUTH;
    if (!expected || !safeEqual(req.get('authorization') ?? '', expected)) {
      throw new HttpError(401, 'unauthorized', 'Bad webhook authorization.');
    }
    await handleWebhook(ctx, (req.body?.event ?? {}) as Parameters<typeof handleWebhook>[1]);
    res.status(200).json({ ok: true });
  });

  const admin = requireAdmin(ctx);

  r.get('/admin/reports', admin, async (req, res) => {
    const { status } = z.object({ status: z.enum(['open', 'resolved']).default('open') }).parse(req.query);
    const rows = await ctx.db
      .select({ report: reports, submission: submissions })
      .from(reports)
      .leftJoin(submissions, eq(submissions.id, reports.submissionId))
      .where(eq(reports.status, status))
      .orderBy(desc(reports.createdAt))
      .limit(200);
    res.json(
      rows.map(({ report, submission }) => ({
        ...report,
        submission: submission
          ? { id: submission.id, userId: submission.userId, status: submission.status, imageUrl: ctx.storage.signedUrl(submission.imageKey) }
          : null,
      })),
    );
  });

  r.post('/admin/reports/:id/resolve', admin, async (req, res) => {
    await ctx.db.update(reports).set({ status: 'resolved' }).where(eq(reports.id, z.uuid().parse(req.params.id)));
    res.status(204).end();
  });

  /** Hide a photo: it leaves feeds, and its points leave the leaderboard. */
  r.post('/admin/submissions/:id/remove', admin, async (req, res) => {
    const [row] = await ctx.db
      .update(submissions)
      .set({ status: 'removed', points: 0, rank: null })
      .where(eq(submissions.id, z.uuid().parse(req.params.id)))
      .returning();
    if (!row) throw notFound('Submission not found.');
    await ctx.storage.delete(row.imageKey);
    res.status(204).end();
  });

  /** Ban: blocks sign-in and API access, hides the user everywhere. */
  r.post('/admin/users/:id/ban', admin, async (req, res) => {
    const id = z.uuid().parse(req.params.id);
    const [row] = await ctx.db.update(users).set({ bannedAt: ctx.clock.now() }).where(eq(users.id, id)).returning();
    if (!row) throw notFound('User not found.');
    await revokeRefreshTokens(ctx, id);
    res.status(204).end();
  });

  return r;
}
