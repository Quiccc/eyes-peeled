import { Router } from 'express';
import { z } from 'zod';

import type { Ctx } from '../context';
import { reports } from '../db/schema';
import { HttpError } from '../lib/errors';
import { me, requireAuth } from '../middleware/auth';
import { profileOf } from '../services/profile';
import {
  block,
  feedToday,
  incomingRequests,
  removeFriend,
  respond,
  search,
  sendRequest,
  visibleUser,
} from '../services/social';

const userIdBody = z.object({ userId: z.uuid() });

export function socialRoutes(ctx: Ctx) {
  const r = Router();
  const auth = requireAuth(ctx);

  r.get('/feed/today', auth, async (req, res) => {
    res.json(await feedToday(ctx, me(req)));
  });

  r.get('/friends/requests', auth, async (req, res) => {
    res.json(await incomingRequests(ctx, me(req)));
  });

  r.post('/friends/requests', auth, async (req, res) => {
    await sendRequest(ctx, me(req), userIdBody.parse(req.body).userId);
    res.status(204).end();
  });

  r.post('/friends/requests/:id/:action', auth, async (req, res) => {
    const action = z.enum(['accept', 'decline']).parse(req.params.action);
    await respond(ctx, me(req), String(req.params.id), action);
    res.status(204).end();
  });

  r.delete('/friends/:userId', auth, async (req, res) => {
    await removeFriend(ctx, me(req), z.uuid().parse(req.params.userId));
    res.status(204).end();
  });

  r.get('/users/search', auth, async (req, res) => {
    const { q } = z.object({ q: z.string().max(40).default('') }).parse(req.query);
    res.json(await search(ctx, me(req), q));
  });

  r.get('/users/:id', auth, async (req, res) => {
    const viewer = me(req);
    const id = String(req.params.id);
    const subject = id === viewer.id ? viewer : await visibleUser(ctx, viewer.id, id);
    res.json(await profileOf(ctx, viewer, subject));
  });

  r.post('/reports', auth, async (req, res) => {
    const body = z
      .object({
        submissionId: z.uuid().optional(),
        userId: z.uuid().optional(),
        reason: z.enum(['inappropriate', 'spam', 'cheating', 'other']),
      })
      .parse(req.body);
    if (!body.submissionId && !body.userId) throw new HttpError(400, 'bad_request', 'Say what you are reporting.');
    try {
      await ctx.db.insert(reports).values({ reporterId: me(req).id, ...body });
    } catch {
      // Unknown submission or user id (foreign key). Nothing to moderate, so accept quietly.
    }
    res.status(204).end();
  });

  r.post('/blocks', auth, async (req, res) => {
    await block(ctx, me(req), userIdBody.parse(req.body).userId);
    res.status(204).end();
  });

  return r;
}
