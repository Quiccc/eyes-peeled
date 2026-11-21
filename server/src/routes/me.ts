import { Router } from 'express';
import { z } from 'zod';

import type { DeleteAccountRequest, User, UserProfile } from '@shared/types';

import type { Ctx } from '../context';
import { badRequest } from '../lib/errors';
import { toUser } from '../lib/present';
import { isJpeg, jpegUpload } from '../lib/upload';
import { me, requireAuth } from '../middleware/auth';
import { clearAvatar, deleteAccount, setAvatar, setUsername } from '../services/account';
import { profileOf } from '../services/profile';
import { syncPremium } from '../services/revenuecat';

/** Largest profile picture accepted. The app sends 512px square JPEGs, well under 100 KB. */
export const MAX_AVATAR_BYTES = 1024 * 1024;

const avatarUpload = jpegUpload(MAX_AVATAR_BYTES);

export function meRoutes(ctx: Ctx) {
  const r = Router();
  const auth = requireAuth(ctx);

  r.get('/me', auth, (req, res) => {
    res.json(toUser(me(req), ctx.storage) satisfies User);
  });

  r.patch('/me', auth, async (req, res) => {
    const { username } = z.object({ username: z.string().max(50) }).parse(req.body);
    res.json(toUser(await setUsername(ctx, me(req), username), ctx.storage) satisfies User);
  });

  r.delete('/me', auth, async (req, res) => {
    const body: DeleteAccountRequest = z
      .object({ appleAuthorizationCode: z.string().min(1).max(2000).optional() })
      .parse(req.body ?? {});
    await deleteAccount(ctx, me(req), body);
    res.status(204).end();
  });

  r.put('/me/avatar', auth, avatarUpload.single('photo'), async (req, res) => {
    const file = req.file;
    if (!file) throw badRequest('Attach the picture in the "photo" field.');
    if (!isJpeg(file.buffer)) throw badRequest('The picture must be a JPEG.');
    res.json(toUser(await setAvatar(ctx, me(req), file.buffer), ctx.storage) satisfies User);
  });

  r.delete('/me/avatar', auth, async (req, res) => {
    res.json(toUser(await clearAvatar(ctx, me(req).id), ctx.storage) satisfies User);
  });

  r.get('/me/profile', auth, async (req, res) => {
    res.json((await profileOf(ctx, me(req), me(req))) satisfies UserProfile);
  });

  r.post('/me/purchases/sync', auth, async (req, res) => {
    res.json(toUser(await syncPremium(ctx, me(req)), ctx.storage) satisfies User);
  });

  return r;
}
