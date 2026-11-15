import { Router } from 'express';

import type { Ctx } from '../context';
import { HttpError } from '../lib/errors';

/** Serves photos behind short-lived signed URLs (see services/storage.ts). No Authorization header needed. */
export function fileRoutes(ctx: Ctx) {
  const r = Router();

  r.get('/files/*key', (req, res) => {
    const parts = req.params.key as unknown as string[];
    const key = Array.isArray(parts) ? parts.join('/') : String(parts);
    const exp = typeof req.query.exp === 'string' ? req.query.exp : undefined;
    const sig = typeof req.query.sig === 'string' ? req.query.sig : undefined;
    const file = ctx.storage.resolveSigned(key, exp, sig);
    if (!file) throw new HttpError(403, 'forbidden', 'This link has expired.');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.sendFile(file, (err) => {
      if (err && !res.headersSent) res.status(404).json({ code: 'not_found', message: 'Photo not found.' });
    });
  });

  return r;
}
