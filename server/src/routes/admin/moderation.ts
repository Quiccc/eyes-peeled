import { type RequestHandler, Router } from 'express';
import { z } from 'zod';

import type { Ctx } from '../../context';
import { reportStatuses } from '../../domain/enums';
import type { AdminReport } from '../../dto/admin';
import { banUser, listReports, removeSubmission, resolveReport, unbanUser } from '../../services/moderation';

const idParam = (id: unknown) => z.uuid().parse(id);

/** Reports and what to do about them: resolve, remove the photo, ban or unban the user. */
export function moderationRoutes(ctx: Ctx, admin: RequestHandler) {
  const r = Router();

  r.get('/admin/reports', admin, async (req, res) => {
    const { status } = z.object({ status: z.enum(reportStatuses).default('open') }).parse(req.query);
    res.json((await listReports(ctx, status)) satisfies AdminReport[]);
  });

  r.post('/admin/reports/:id/resolve', admin, async (req, res) => {
    await resolveReport(ctx, idParam(req.params.id));
    res.status(204).end();
  });

  r.post('/admin/submissions/:id/remove', admin, async (req, res) => {
    await removeSubmission(ctx, idParam(req.params.id));
    res.status(204).end();
  });

  r.post('/admin/users/:id/ban', admin, async (req, res) => {
    await banUser(ctx, idParam(req.params.id));
    res.status(204).end();
  });

  r.post('/admin/users/:id/unban', admin, async (req, res) => {
    await unbanUser(ctx, idParam(req.params.id));
    res.status(204).end();
  });

  return r;
}
