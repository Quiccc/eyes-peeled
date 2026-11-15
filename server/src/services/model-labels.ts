import { eq } from 'drizzle-orm';

import type { Ctx } from '../context';
import { words } from '../db/schema';
import { badRequest, HttpError } from '../lib/errors';

/**
 * Every word must be a class the running YOLO model detects, or no photo of it could ever pass.
 * These checks keep unknown words out of the schedule.
 */

/**
 * Labels the running model knows (lower case), or null when there's no YOLO service to ask.
 * A configured service that can't be reached is an error: scheduling blind could pick words the
 * model can't judge.
 */
export async function knownLabels(ctx: Ctx): Promise<Set<string> | null> {
  try {
    return await ctx.model.classes();
  } catch (e) {
    console.error('model classes failed', e);
    throw new HttpError(503, 'model_unavailable', "Can't reach the YOLO service to check which words it knows. Try again in a moment.");
  }
}

/** `label` filter for word picks: everything when there's no model to ask. */
export const isKnownBy = (known: Set<string> | null) => (label: string) => !known || known.has(label.toLowerCase());

export function assertKnown(known: Set<string> | null, label: string) {
  if (!isKnownBy(known)(label)) {
    throw badRequest(`The model doesn't know "${label}". Train it on that word first.`);
  }
}

/** Enabled words the running model doesn't know. Empty when there's no YOLO service. */
export async function wordsUnknownToModel(ctx: Ctx): Promise<string[]> {
  const known = await ctx.model.classes();
  if (!known) return [];
  const enabled = await ctx.db.select({ label: words.label }).from(words).where(eq(words.enabled, true));
  return [...new Set(enabled.map((w) => w.label))].filter((l) => !known.has(l.toLowerCase())).sort();
}
