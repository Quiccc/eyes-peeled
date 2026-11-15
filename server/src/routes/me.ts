import { eq } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';

import type { User } from '@shared/types';

import type { Ctx } from '../context';
import { users } from '../db/schema';
import { HttpError } from '../lib/errors';
import { toUser } from '../lib/present';
import { isUniqueViolation } from '../lib/sql';
import { me, requireAuth } from '../middleware/auth';
import { profileOf } from '../services/profile';
import { deleteCustomer, syncPremium } from '../services/revenuecat';

export const USERNAME = /^[a-z0-9_]{3,20}$/;

export function meRoutes(ctx: Ctx) {
  const r = Router();
  r.use('/me', requireAuth(ctx));

  r.get('/me', (req, res) => {
    res.json(toUser(me(req)) satisfies User);
  });

  r.patch('/me', async (req, res) => {
    const { username } = z.object({ username: z.string().max(50) }).parse(req.body);
    const clean = username.trim().toLowerCase();
    if (!USERNAME.test(clean)) {
      throw new HttpError(400, 'invalid_username', 'Use 3–20 letters, numbers or underscores.');
    }
    try {
      const [user] = await ctx.db.update(users).set({ username: clean }).where(eq(users.id, me(req).id)).returning();
      if (!user) throw new Error('user vanished');
      res.json(toUser(user));
    } catch (e) {
      if (isUniqueViolation(e)) throw new HttpError(409, 'username_taken', 'That username is taken.');
      throw e;
    }
  });

  r.delete('/me', async (req, res) => {
    const user = me(req);
    // TODO(apple): revoking the Apple token needs the app to send Apple's authorizationCode
    // (exchange it at https://appleid.apple.com/auth/token, then POST /auth/revoke). Not sent yet.
    await deleteCustomer(ctx, user.id);
    // Cascades to submissions, tokens, friendships, requests and blocks.
    await ctx.db.delete(users).where(eq(users.id, user.id));
    await ctx.storage.delete(`${user.id}/`);
    res.status(204).end();
  });

  r.get('/me/profile', async (req, res) => {
    res.json(await profileOf(ctx, me(req), me(req)));
  });

  r.post('/me/purchases/sync', async (req, res) => {
    res.json(toUser(await syncPremium(ctx, me(req))));
  });

  return r;
}
