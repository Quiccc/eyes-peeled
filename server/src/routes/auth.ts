import { Router } from 'express';
import { z } from 'zod';

import type { AuthResponse, AuthTokens } from '@shared/types';

import { verifyIdentity } from '../auth/identity';
import { issueTokens, revokeRefreshTokens, rotateRefreshToken } from '../auth/tokens';
import type { Ctx } from '../context';
import { sessionExpired } from '../lib/errors';
import { toUser } from '../lib/present';
import { me, requireAuth } from '../middleware/auth';
import { findUser, signInUser } from '../services/users';

const signInBody = z.object({
  provider: z.enum(['apple', 'google']),
  idToken: z.string().min(1).max(8192),
  fullName: z.string().max(100).nullish(),
});

export function authRoutes(ctx: Ctx) {
  const r = Router();

  r.post('/auth/signin', async (req, res) => {
    const identity = await verifyIdentity(ctx.env, signInBody.parse(req.body));
    const { user, isNewUser } = await signInUser(ctx, identity);
    res.json({ ...(await issueTokens(ctx, user.id)), user: toUser(user), isNewUser } satisfies AuthResponse);
  });

  r.post('/auth/refresh', async (req, res) => {
    const { refreshToken } = z.object({ refreshToken: z.string().min(1).max(200) }).parse(req.body);
    const rotated = await rotateRefreshToken(ctx, refreshToken);
    if (!rotated) throw sessionExpired();
    const user = await findUser(ctx, rotated.userId);
    if (!user || user.bannedAt) throw sessionExpired();
    res.json(rotated.tokens satisfies AuthTokens);
  });

  r.post('/auth/signout', requireAuth(ctx), async (req, res) => {
    // The app sends no body, so this signs out every device. A body with { refreshToken } revokes only that one.
    const { refreshToken } = z.object({ refreshToken: z.string().optional().catch(undefined) }).catch({}).parse(req.body ?? {});
    await revokeRefreshTokens(ctx, me(req).id, refreshToken);
    res.status(204).end();
  });

  return r;
}
