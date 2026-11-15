import type { ErrorRequestHandler, RequestHandler } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';

/** Thrown anywhere in a handler; becomes `{ code, message }` with this status. */
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
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

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ code: err.code, message: err.message });
    return;
  }
  if (err instanceof ZodError) {
    const first = err.issues[0];
    res.status(400).json({
      code: 'bad_request',
      message: first ? `Invalid ${first.path.join('.') || 'request'}: ${first.message}` : 'Invalid request.',
    });
    return;
  }
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ code: 'photo_too_large', message: 'That photo is too large. Please try again.' });
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
  console.error(err);
  res.status(500).json({ code: 'server_error', message: 'Something went wrong on our side. Please try again.' });
};
