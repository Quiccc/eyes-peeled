import type { RequestHandler } from 'express';

import type { Ctx } from '../context';
import { notFound } from '../lib/errors';
import { safeEqual } from '../lib/safe-equal';

/**
 * Bearer ADMIN_TOKEN. Admin routes are off when it isn't set. A wrong token gets a 404 like any
 * unknown path, so the admin API doesn't advertise itself.
 */
export function requireAdmin(ctx: Ctx): RequestHandler {
  return (req, _res, next) => {
    const token = ctx.env.ADMIN_TOKEN;
    if (!token || !safeEqual(req.get('authorization') ?? '', `Bearer ${token}`)) throw notFound();
    next();
  };
}
