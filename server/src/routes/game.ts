import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';

import type { Ctx } from '../context';
import { HttpError } from '../lib/errors';
import { me, requireAuth } from '../middleware/auth';
import { getLeaderboard } from '../services/leaderboard';
import { createSubmission, getDaily, getSubmissionFor } from '../services/submissions';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 1 } });

const isJpeg = (b: Buffer) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

export function gameRoutes(ctx: Ctx) {
  const r = Router();
  const auth = requireAuth(ctx);

  r.get('/daily', auth, async (req, res) => {
    res.json(await getDaily(ctx, me(req)));
  });

  r.post('/words/:wordId/submissions', auth, upload.single('photo'), async (req, res) => {
    const file = req.file;
    if (!file) throw new HttpError(400, 'bad_request', 'Attach the photo in the "photo" field.');
    if (!isJpeg(file.buffer)) throw new HttpError(400, 'bad_request', 'The photo must be a JPEG.');
    const wordId = String(req.params.wordId);
    if (!/^[0-9a-f-]{36}$/i.test(wordId)) throw new HttpError(404, 'word_not_found', 'This word is no longer active.');
    res.json(await createSubmission(ctx, me(req), wordId, file.buffer));
  });

  r.get('/submissions/:id', auth, async (req, res) => {
    res.json(await getSubmissionFor(ctx, me(req), String(req.params.id)));
  });

  r.get('/leaderboard', auth, async (req, res) => {
    const q = z
      .object({ scope: z.enum(['global', 'friends']).default('global'), cursor: z.string().max(20).optional() })
      .parse(req.query);
    res.json(await getLeaderboard(ctx, me(req), q.scope, q.cursor));
  });

  return r;
}
