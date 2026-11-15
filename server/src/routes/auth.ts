import { and, eq } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';

import type { AuthResponse, AuthTokens } from '@shared/types';

import { verifyIdentity } from '../auth/identity';
import { issueTokens, revokeRefreshTokens, rotateRefreshToken } from '../auth/tokens';
import type { Ctx } from '../context';
import { users } from '../db/schema';
import { HttpError } from '../lib/errors';
import { toUser } from '../lib/present';
import { me, requireAuth } from '../middleware/auth';

const signInBody = z.object({
  provider: z.enum(['apple', 'google']),
  idToken: z.string().min(1).max(8192),
  fullName: z.string().max(100).nullish(),
});

const expired = () => new HttpError(401, 'unauthorized', 'Your session has expired. Please sign in again.');

export function authRoutes(ctx: Ctx) {
  const r = Router();

  r.post('/auth/signin', async (req, res) => {
    const body = signInBody.parse(req.body);
    const id = await verifyIdentity(ctx.env, body);

    const [existing] = await ctx.db
      .select()
      .from(users)
      .where(and(eq(users.provider, id.provider), eq(users.providerSub, id.sub)));

    let user = existing;
    if (!user) {
      [user] = await ctx.db
        .insert(users)
        .values({ provider: id.provider, providerSub: id.sub, displayName: id.displayName, avatarUrl: id.avatarUrl })
        .returning();
    } else if (id.provider === 'google' || (id.displayName && !user.displayName)) {
      // Google: refresh name/picture on every sign-in. Apple: sends the name only once.
      [user] = await ctx.db
        .update(users)
        .set({
          displayName: id.displayName ?? user.displayName,
          avatarUrl: id.provider === 'google' ? id.avatarUrl : user.avatarUrl,
        })
        .where(eq(users.id, user.id))
        .returning();
    }
    if (!user) throw new Error('sign-in upsert failed');
    if (user.bannedAt) throw new HttpError(403, 'banned', 'This account has been suspended.');

    const response: AuthResponse = { ...(await issueTokens(ctx, user.id)), user: toUser(user), isNewUser: !existing };
    res.json(response);
  });

  r.post('/auth/refresh', async (req, res) => {
    const { refreshToken } = z.object({ refreshToken: z.string().min(1).max(200) }).parse(req.body);
    const rotated = await rotateRefreshToken(ctx, refreshToken);
    if (!rotated) throw expired();
    const [user] = await ctx.db.select().from(users).where(eq(users.id, rotated.userId));
    if (!user || user.bannedAt) throw expired();
    const response: AuthTokens = rotated.tokens;
    res.json(response);
  });

  r.post('/auth/signout', requireAuth(ctx), async (req, res) => {
    // The app sends no body, so this signs out every device. A body with { refreshToken } revokes only that one.
    const token = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : undefined;
    await revokeRefreshTokens(ctx, me(req).id, token);
    res.status(204).end();
  });

  return r;
}
