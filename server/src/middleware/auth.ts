import type { Request, RequestHandler } from 'express';

import { verifyAccessToken } from '../auth/tokens';
import type { Ctx } from '../context';
import type { UserRow } from '../db/schema';
import { banned, sessionExpired } from '../lib/errors';
import { findUser } from '../services/users';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserRow;
    }
  }
}

/** Requires a valid access token for an existing, unbanned user. Sets req.user. */
export function requireAuth(ctx: Ctx): RequestHandler {
  return async (req, _res, next) => {
    const header = req.get('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    const userId = token ? await verifyAccessToken(ctx, token) : null;
    if (!userId) throw sessionExpired();
    const user = await findUser(ctx, userId);
    if (!user) throw sessionExpired();
    if (user.bannedAt) throw banned();
    req.user = user;
    next();
  };
}

/** The signed-in user. Only call behind requireAuth. */
export function me(req: Request): UserRow {
  if (!req.user) throw sessionExpired();
  return req.user;
}
