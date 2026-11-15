import { and, eq, gte, inArray, lt } from 'drizzle-orm';

import type { FeedItem } from '@shared/types';

import type { Ctx } from '../context';
import { submissions, users, type SubmissionRow, type UserRow } from '../db/schema';
import { toFeedItem } from '../lib/present';
import { dayStartUtc, nextDayStartUtc } from '../lib/time';
import { dailyWordInfo } from './daily-words';
import { blockedIds, friendIds } from './relationships';

/** Friends' finds today. */

export async function feedToday(ctx: Ctx, me: UserRow): Promise<FeedItem[]> {
  const blocked = await blockedIds(ctx, me.id);
  const ids = (await friendIds(ctx, me.id)).filter((id) => !blocked.has(id));
  return todaysFinds(ctx, ids);
}

/** Valid submissions of `userIds` received today (UTC). */
function validToday(ctx: Ctx, userIds: string[]): Promise<SubmissionRow[]> {
  const now = ctx.clock.now();
  if (!userIds.length) return Promise.resolve([]);
  return ctx.db
    .select()
    .from(submissions)
    .where(
      and(
        inArray(submissions.userId, userIds),
        eq(submissions.status, 'valid'),
        gte(submissions.receivedAt, dayStartUtc(now)),
        lt(submissions.receivedAt, nextDayStartUtc(now)),
      ),
    );
}

/** Valid finds today by these users, newest first. Banned users' finds are left out. */
export async function todaysFinds(ctx: Ctx, userIds: string[]): Promise<FeedItem[]> {
  const subs = await validToday(ctx, userIds);
  if (!subs.length) return [];
  const owners = await ctx.db
    .select()
    .from(users)
    .where(inArray(users.id, [...new Set(subs.map((s) => s.userId))]));
  const byId = new Map(owners.filter((u) => !u.bannedAt).map((u) => [u.id, u]));
  const info = await dailyWordInfo(ctx, [...new Set(subs.map((s) => s.dailyWordId))]);
  return subs
    .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime())
    .flatMap((s) => {
      const owner = byId.get(s.userId);
      const word = info.get(s.dailyWordId);
      return owner && word ? [toFeedItem(s, owner, word, ctx.storage)] : [];
    });
}
