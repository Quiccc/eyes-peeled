import { and, asc, eq } from 'drizzle-orm';

import type { Ctx } from '../context';
import { dailyWords, submissions, users } from '../db/schema';
import { difficulties } from '../domain/enums';
import { comboCredits, comboForLinks, linksAmong } from './scoring';

/**
 * Combo bonuses: adjacent trail nodes that a player found on the same UTC day link up and pay a
 * bonus (see COMBO_BONUS). The bonus is stored on the find that completed the link, so every
 * total stays a plain SUM(points + combo_points).
 */

type Tx = Parameters<Parameters<Ctx['db']['transaction']>[0]>[0];

/**
 * The player's valid finds on `date`, oldest verdict first. Locks the user row first so two verdicts
 * for the same player can't both credit the same link.
 */
async function findsOfDay(tx: Tx, userId: string, date: string) {
  await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for('update');
  const rows = await tx
    .select({ id: submissions.id, difficulty: dailyWords.difficulty, comboPoints: submissions.comboPoints })
    .from(submissions)
    .innerJoin(dailyWords, eq(dailyWords.id, submissions.dailyWordId))
    .where(and(eq(submissions.userId, userId), eq(dailyWords.date, date), eq(submissions.status, 'valid')))
    .orderBy(asc(submissions.decidedAt), asc(submissions.receivedAt), asc(submissions.id));
  return rows.map((r) => ({ ...r, position: difficulties.indexOf(r.difficulty) }));
}

/**
 * A find was just marked valid: credit it with what it added to the day's combo. Earlier finds keep
 * their credits, so the result doesn't depend on how verdicts that finish together are ordered.
 */
export async function creditCombo(tx: Tx, userId: string, date: string, submissionId: string): Promise<void> {
  const finds = await findsOfDay(tx, userId, date);
  const total = comboForLinks(linksAmong(finds.map((f) => f.position)));
  const held = finds.filter((f) => f.id !== submissionId).reduce((sum, f) => sum + f.comboPoints, 0);
  await tx
    .update(submissions)
    .set({ comboPoints: Math.max(0, total - held) })
    .where(eq(submissions.id, submissionId));
}

/**
 * A find left the day (moderation): replay the remaining finds in verdict order so links that broke
 * stop paying and the credits again sum to the day's combo.
 */
export async function recomputeCombos(tx: Tx, userId: string, date: string): Promise<void> {
  const finds = await findsOfDay(tx, userId, date);
  const credits = comboCredits(finds);
  for (const f of finds) {
    const comboPoints = credits.get(f.id) ?? 0;
    if (comboPoints !== f.comboPoints) await tx.update(submissions).set({ comboPoints }).where(eq(submissions.id, f.id));
  }
}
