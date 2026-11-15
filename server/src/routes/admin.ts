import { timingSafeEqual } from 'node:crypto';

import { desc, eq, inArray } from 'drizzle-orm';
import { Router, type RequestHandler } from 'express';
import { z } from 'zod';

import { revokeRefreshTokens } from '../auth/tokens';
import type { Ctx } from '../context';
import { difficulties, reports, submissions, users } from '../db/schema';
import { HttpError, notFound } from '../lib/errors';
import { wordStats } from '../services/admin-stats';
import { handleWebhook } from '../services/revenuecat';
import {
  addWord,
  fillMonth,
  getSchedule,
  listWords,
  setDay,
  updateWord,
  wordsUnknownToModel,
} from '../services/schedule';

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
    // The reported user: named directly, or the owner of the reported photo.
    const targetIds = [...new Set(rows.map((r) => r.report.userId ?? r.submission?.userId).filter((id): id is string => !!id))];
    const targets = targetIds.length
      ? await ctx.db
          .select({ id: users.id, username: users.username, bannedAt: users.bannedAt })
          .from(users)
          .where(inArray(users.id, targetIds))
      : [];
    const byId = new Map(targets.map((u) => [u.id, u]));
    res.json(
      rows.map(({ report, submission }) => ({
        ...report,
        submission: submission
          ? { id: submission.id, userId: submission.userId, status: submission.status, imageUrl: ctx.storage.signedUrl(submission.imageKey) }
          : null,
        target: byId.get(report.userId ?? submission?.userId ?? '') ?? null,
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

  r.post('/admin/users/:id/unban', admin, async (req, res) => {
    const [row] = await ctx.db
      .update(users)
      .set({ bannedAt: null })
      .where(eq(users.id, z.uuid().parse(req.params.id)))
      .returning({ id: users.id });
    if (!row) throw notFound('User not found.');
    res.status(204).end();
  });

  // ---- Admin panel ----------------------------------------------------------------

  /** Token check for the panel's login screen. */
  r.get('/admin/check', admin, (_req, res) => {
    res.status(204).end();
  });

  const month = z.object({ month: z.string() });
  const difficulty = z.enum(difficulties);

  r.get('/admin/schedule', admin, async (req, res) => {
    res.json(await getSchedule(ctx, month.parse(req.query).month));
  });

  /** Fill the month's empty days. Planned days are kept. */
  r.post('/admin/schedule', admin, async (req, res) => {
    res.json(await fillMonth(ctx, month.parse(req.body).month));
  });

  r.put('/admin/schedule/:date/:difficulty', admin, async (req, res) => {
    const { wordId } = z.object({ wordId: z.uuid() }).parse(req.body);
    await setDay(ctx, String(req.params.date), difficulty.parse(req.params.difficulty), wordId);
    res.status(204).end();
  });

  r.get('/admin/words', admin, async (_req, res) => {
    res.json(await listWords(ctx));
  });

  r.post('/admin/words', admin, async (req, res) => {
    const body = z.object({ label: z.string().trim().min(1).max(60), difficulty }).parse(req.body);
    await addWord(ctx, body.label, body.difficulty);
    res.status(204).end();
  });

  r.patch('/admin/words/:id', admin, async (req, res) => {
    const patch = z
      .object({ enabled: z.boolean().optional(), minConfidence: z.number().min(0).max(1).nullable().optional() })
      .parse(req.body);
    await updateWord(ctx, z.uuid().parse(req.params.id), patch);
    res.status(204).end();
  });

  /** YOLO service health, latest word-test report, and enabled words the model doesn't know. */
  r.get('/admin/model', admin, async (_req, res) => {
    if (!ctx.model.configured) {
      res.json({ configured: false, threshold: ctx.env.YOLO_MIN_CONFIDENCE, health: null, report: null, unknownWords: [], error: null });
      return;
    }
    try {
      const [health, report, unknownWords] = await Promise.all([
        ctx.model.health(),
        ctx.model.report(),
        wordsUnknownToModel(ctx),
      ]);
      res.json({ configured: true, threshold: ctx.env.YOLO_MIN_CONFIDENCE, health, report, unknownWords, error: null });
    } catch (e) {
      res.json({
        configured: true,
        threshold: ctx.env.YOLO_MIN_CONFIDENCE,
        health: null,
        report: null,
        unknownWords: [],
        error: e instanceof Error ? e.message : 'YOLO service unreachable',
      });
    }
  });

  r.get('/admin/stats', admin, async (req, res) => {
    const range = z.object({ from: z.string().optional(), to: z.string().optional() }).parse(req.query);
    res.json(await wordStats(ctx, range));
  });

  return r;
}
