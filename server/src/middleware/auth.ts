import { eq } from 'drizzle-orm';
import type { Request, RequestHandler } from 'express';

import { verifyAccessToken } from '../auth/tokens';
import type { Ctx } from '../context';
import { users, type UserRow } from '../db/schema';
import { HttpError } from '../lib/errors';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserRow;
    }
  }
}

const unauthorized = () => new HttpError(401, 'unauthorized', 'Your session has expired. Please sign in again.');

/** Requires a valid access token for an existing, unbanned user. Sets req.user. */
export function requireAuth(ctx: Ctx): RequestHandler {
  return async (req, _res, next) => {
    const header = req.get('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    const userId = token ? await verifyAccessToken(ctx, token) : null;
    if (!userId) throw unauthorized();
    const [user] = await ctx.db.select().from(users).where(eq(users.id, userId));
    if (!user) throw unauthorized();
    if (user.bannedAt) throw new HttpError(403, 'banned', 'This account has been suspended.');
    req.user = user;
    next();
  };
}

/** The signed-in user. Only call behind requireAuth. */
export function me(req: Request): UserRow {
  if (!req.user) throw unauthorized();
  return req.user;
}
