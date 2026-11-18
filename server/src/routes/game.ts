import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';

import type { Ctx } from '../context';
import { badRequest } from '../lib/errors';
import { me, requireAuth } from '../middleware/auth';
import { getLeaderboard } from '../services/leaderboard';
import { createSubmission, getDaily, getSubmissionFor } from '../services/submissions';

/**
 * Largest photo accepted. The app sends ≤1280px JPEGs (usually < 500 KB). Claude rejects images over
 * 5 MB once base64-encoded (4/3 larger), so anything bigger could never be checked.
 */
export const MAX_PHOTO_BYTES = Math.floor(3.75 * 1024 * 1024);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_PHOTO_BYTES, files: 1 } });

const isJpeg = (b: Buffer) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

const leaderboardQuery = z.object({
  scope: z.enum(['global', 'friends']).default('global'),
  /** An offset from the previous page; anything else starts from the top. */
  cursor: z.string().max(20).regex(/^\d+$/).optional().catch(undefined),
});

export function gameRoutes(ctx: Ctx) {
  const r = Router();
  const auth = requireAuth(ctx);

  r.get('/daily', auth, async (req, res) => {
    res.json(await getDaily(ctx, me(req)));
  });

  r.post('/words/:wordId/submissions', auth, upload.single('photo'), async (req, res) => {
    const file = req.file;
    if (!file) throw badRequest('Attach the photo in the "photo" field.');
    if (!isJpeg(file.buffer)) throw badRequest('The photo must be a JPEG.');
    res.json(await createSubmission(ctx, me(req), String(req.params.wordId), file.buffer));
  });

  r.get('/submissions/:id', auth, async (req, res) => {
    res.json(await getSubmissionFor(ctx, me(req), String(req.params.id)));
  });

  r.get('/leaderboard', auth, async (req, res) => {
    const q = leaderboardQuery.parse(req.query);
    res.json(await getLeaderboard(ctx, me(req), q.scope, q.cursor));
  });

  return r;
}
