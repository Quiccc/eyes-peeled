import { Router } from 'express';
import { z } from 'zod';

import type { User, UserProfile } from '@shared/types';

import type { Ctx } from '../context';
import { toUser } from '../lib/present';
import { me, requireAuth } from '../middleware/auth';
import { deleteAccount, setUsername } from '../services/account';
import { profileOf } from '../services/profile';
import { syncPremium } from '../services/revenuecat';

export function meRoutes(ctx: Ctx) {
  const r = Router();
  const auth = requireAuth(ctx);

  r.get('/me', auth, (req, res) => {
    res.json(toUser(me(req)) satisfies User);
  });

  r.patch('/me', auth, async (req, res) => {
    const { username } = z.object({ username: z.string().max(50) }).parse(req.body);
    res.json(toUser(await setUsername(ctx, me(req), username)) satisfies User);
  });

  r.delete('/me', auth, async (req, res) => {
    await deleteAccount(ctx, me(req));
    res.status(204).end();
  });

  r.get('/me/profile', auth, async (req, res) => {
    res.json((await profileOf(ctx, me(req), me(req))) satisfies UserProfile);
  });

  r.post('/me/purchases/sync', auth, async (req, res) => {
    res.json(toUser(await syncPremium(ctx, me(req))) satisfies User);
  });

  return r;
}
