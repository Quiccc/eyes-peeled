import { Router } from 'express';

import type { Ctx } from '../../context';
import { requireAdmin } from '../../middleware/admin';
import { moderationRoutes } from './moderation';
import { panelRoutes } from './panel';

/** /admin/*: moderation (Apple guideline 1.2) and the admin panel's API. Needs ADMIN_TOKEN. */
export function adminRoutes(ctx: Ctx) {
  const admin = requireAdmin(ctx);
  return Router().use(moderationRoutes(ctx, admin), panelRoutes(ctx, admin));
}
