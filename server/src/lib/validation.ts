import { z } from 'zod';

import type { HttpError } from './errors';

/** Loose UUID shape: enough to keep junk out of uuid columns (Postgres would reject it with a 500). */
const UUID_SHAPE = /^[0-9a-f-]{36}$/i;

export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_SHAPE.test(v);

/**
 * An id from a path or body that must name an existing row. Anything that isn't id-shaped can't
 * exist, so it gets the same error as an unknown id (usually a 404) instead of a validation error.
 */
export function existingId(v: unknown, missing: () => HttpError): string {
  if (!isUuid(v)) throw missing();
  return v;
}

/** YYYY-MM */
export const zMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must look like 2026-12.');

/** YYYY-MM-DD */
export const zIsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Dates must look like 2026-12-01.');
