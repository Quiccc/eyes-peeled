import { and, count, desc, eq, sql } from 'drizzle-orm';

import type { UserProfile } from '@shared/types';

import type { Ctx } from '../context';
import { submissions, type UserRow } from '../db/schema';
import { toUser } from '../lib/present';
import { addDays, todayUtc } from '../lib/time';
import { todaysFinds } from './feed';
import { monthStanding } from './leaderboard';
import { relation } from './relationships';

/**
 * Consecutive UTC days with at least one valid find, ending today or yesterday
 * (so the streak still shows in the morning before the user has played).
 */
export function streakFrom(days: string[], today: string): number {
  const set = new Set(days);
  let day = set.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (set.has(day)) {
    streak += 1;
    day = addDays(day, -1);
  }
  return streak;
}

export async function profileOf(ctx: Ctx, viewer: UserRow, subject: UserRow): Promise<UserProfile> {
  const isSelf = viewer.id === subject.id;
  const rel = isSelf ? { status: 'friends' as const, requestId: null } : await relation(ctx, viewer.id, subject.id);

  const [{ n: totalFinds } = { n: 0 }] = await ctx.db
    .select({ n: count() })
    .from(submissions)
    .where(and(eq(submissions.userId, subject.id), eq(submissions.status, 'valid')));

  const dayRows = await ctx.db
    .selectDistinct({ day: sql<string>`to_char(${submissions.receivedAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')` })
    .from(submissions)
    .where(and(eq(submissions.userId, subject.id), eq(submissions.status, 'valid')))
    .orderBy(desc(sql`1`))
    .limit(400);

  const standing = await monthStanding(ctx, viewer, subject.id);

  return {
    user: toUser(subject, ctx.storage),
    friendStatus: rel.status,
    requestId: rel.requestId,
    monthPoints: standing.monthPoints,
    monthRank: standing.monthRank,
    streak: streakFrom(
      dayRows.map((r) => r.day),
      todayUtc(ctx.clock),
    ),
    totalFinds,
    today: isSelf || rel.status === 'friends' ? await todaysFinds(ctx, [subject.id]) : [],
  };
}
