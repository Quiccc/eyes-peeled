import { Router } from 'express';

import type { Ctx } from '../context';
import { HttpError } from '../lib/errors';
import { safeEqual } from '../lib/safe-equal';
import { handleWebhook, type WebhookEvent } from '../services/revenuecat';

/** Calls from third parties, authenticated by a shared secret instead of a user token. */
export function webhookRoutes(ctx: Ctx) {
  const r = Router();

  r.post('/webhooks/revenuecat', async (req, res) => {
    const expected = ctx.env.REVENUECAT_WEBHOOK_AUTH;
    if (!expected || !safeEqual(req.get('authorization') ?? '', expected)) {
      throw new HttpError(401, 'unauthorized', 'Bad webhook authorization.');
    }
    // Only known fields are read, each defensively, so the event isn't validated further.
    await handleWebhook(ctx, (req.body?.event ?? {}) as WebhookEvent);
    res.status(200).json({ ok: true });
  });

  return r;
}
