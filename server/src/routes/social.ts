import { Router } from 'express';
import { z } from 'zod';

import type { Ctx } from '../context';
import { reportReasons } from '../domain/enums';
import { badRequest } from '../lib/errors';
import { me, requireAuth } from '../middleware/auth';
import { feedToday } from '../services/feed';
import {
  block,
  blockedUsers,
  friendsList,
  incomingRequests,
  removeFriend,
  respond,
  sendRequest,
  unblock,
} from '../services/friend-requests';
import { fileReport } from '../services/moderation';
import { profileOf } from '../services/profile';
import { profileSubject } from '../services/relationships';
import { search } from '../services/search';

const userIdBody = z.object({ userId: z.uuid() });

export function socialRoutes(ctx: Ctx) {
  const r = Router();
  const auth = requireAuth(ctx);

  r.get('/feed/today', auth, async (req, res) => {
    res.json(await feedToday(ctx, me(req)));
  });

  r.get('/friends', auth, async (req, res) => {
    res.json(await friendsList(ctx, me(req)));
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
    res.json(await profileOf(ctx, viewer, await profileSubject(ctx, viewer, String(req.params.id))));
  });

  r.post('/reports', auth, async (req, res) => {
    const body = z
      .object({ submissionId: z.uuid().optional(), userId: z.uuid().optional(), reason: z.enum(reportReasons) })
      .parse(req.body);
    if (!body.submissionId && !body.userId) throw badRequest('Say what you are reporting.');
    await fileReport(ctx, me(req), body);
    res.status(204).end();
  });

  r.get('/blocks', auth, async (req, res) => {
    res.json(await blockedUsers(ctx, me(req)));
  });

  r.post('/blocks', auth, async (req, res) => {
    await block(ctx, me(req), userIdBody.parse(req.body).userId);
    res.status(204).end();
  });

  r.delete('/blocks/:userId', auth, async (req, res) => {
    await unblock(ctx, me(req), z.uuid().parse(req.params.userId));
    res.status(204).end();
  });

  return r;
}
