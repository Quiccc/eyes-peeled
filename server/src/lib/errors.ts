import type { ErrorRequestHandler, RequestHandler } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';

import { localeOf } from '../i18n/locale';
import { translate } from '../i18n/messages';
import { logger } from './logger';

/**
 * Thrown anywhere in a handler; becomes `{ code, message }` with this status. `message` is English and
 * may hold `{name}` placeholders filled from `params`; it is translated into the request's language
 * on the way out when src/i18n/messages.ts knows it.
 */
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public params?: Record<string, string | number>,
  ) {
    super(message);
  }
}

export const notFound = (message = 'Not found.') => new HttpError(404, 'not_found', message);

export const badRequest = (message: string) => new HttpError(400, 'bad_request', message);

/** Missing, invalid or revoked token, or the user is gone: the app signs out and asks to sign in again. */
export const sessionExpired = () => new HttpError(401, 'unauthorized', 'Your session has expired. Please sign in again.');

export const banned = () => new HttpError(403, 'banned', 'This account has been suspended.');

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new HttpError(404, 'not_found', 'Not found.'));
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const locale = localeOf(res);
  const t = (english: string, params?: Record<string, string | number>) => translate(english, params, locale);
  if (err instanceof HttpError) {
    res.status(err.status).json({ code: err.code, message: t(err.message, err.params) });
    return;
  }
  if (err instanceof ZodError) {
    const first = err.issues[0];
    // Zod's details are for developers and English only; other languages get a plain message.
    res.status(400).json({
      code: 'bad_request',
      message:
        first && locale === 'en' ? `Invalid ${first.path.join('.') || 'request'}: ${first.message}` : t('Invalid request.'),
    });
    return;
  }
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ code: 'photo_too_large', message: t('That photo is too large. Please try again.') });
    } else {
      res.status(400).json({ code: 'bad_request', message: 'Upload a single photo in the "photo" field.' });
    }
    return;
  }
  // express.json() parse errors
  if (err && typeof err === 'object' && 'type' in err && err.type === 'entity.parse.failed') {
    res.status(400).json({ code: 'bad_request', message: 'Invalid JSON body.' });
    return;
  }
  (req.log ?? logger).error({ err }, 'unhandled error');
  res.status(500).json({ code: 'server_error', message: t('Something went wrong on our side. Please try again.') });
};
