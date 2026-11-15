import { and, eq, inArray, or } from 'drizzle-orm';

import type { FriendStatus } from '@shared/types';

import type { Ctx } from '../context';
import { blocks, friendRequests, friendships, users, type UserRow } from '../db/schema';
import { notFound } from '../lib/errors';
import { existingId } from '../lib/validation';

/** Who is friends with, has asked, or has blocked whom. The building blocks of everything social. */

type Relation = { status: FriendStatus; requestId: string | null };

/** Friendships are stored once per pair, smaller id first. */
export const pair = (a: string, b: string) => (a < b ? { userA: a, userB: b } : { userA: b, userB: a });

export const userNotFound = () => notFound('User not found.');

export async function friendIds(ctx: Ctx, userId: string): Promise<string[]> {
  const rows = await ctx.db
    .select()
    .from(friendships)
    .where(or(eq(friendships.userA, userId), eq(friendships.userB, userId)));
  return rows.map((r) => (r.userA === userId ? r.userB : r.userA));
}

/** Users blocked by `userId` or who blocked them. */
export async function blockedIds(ctx: Ctx, userId: string): Promise<Set<string>> {
  const rows = await ctx.db
    .select()
    .from(blocks)
    .where(or(eq(blocks.blockerId, userId), eq(blocks.blockedId, userId)));
  return new Set(rows.map((r) => (r.blockerId === userId ? r.blockedId : r.blockerId)));
}

/** A pending request between `a` and `b`, in either direction. */
const requestBetween = (a: string, b: string) =>
  or(
    and(eq(friendRequests.fromId, a), eq(friendRequests.toId, b)),
    and(eq(friendRequests.fromId, b), eq(friendRequests.toId, a)),
  );

/** Relationship from `meId`'s side to each of `otherIds`, plus the pending request id if any. */
export async function relationsTo(ctx: Ctx, meId: string, otherIds: string[]): Promise<Map<string, Relation>> {
  const result = new Map<string, Relation>();
  if (!otherIds.length) return result;
  const [iBlocked, friends, requests] = await Promise.all([
    ctx.db
      .select({ id: blocks.blockedId })
      .from(blocks)
      .where(and(eq(blocks.blockerId, meId), inArray(blocks.blockedId, otherIds))),
    friendIds(ctx, meId),
    ctx.db
      .select()
      .from(friendRequests)
      .where(
        or(
          and(eq(friendRequests.fromId, meId), inArray(friendRequests.toId, otherIds)),
          and(eq(friendRequests.toId, meId), inArray(friendRequests.fromId, otherIds)),
        ),
      ),
  ]);
  const blockedSet = new Set(iBlocked.map((b) => b.id));
  const friendSet = new Set(friends);
  for (const id of otherIds) {
    if (blockedSet.has(id)) result.set(id, { status: 'blocked', requestId: null });
    else if (friendSet.has(id)) result.set(id, { status: 'friends', requestId: null });
    else {
      const req = requests.find((r) => r.fromId === id || r.toId === id);
      result.set(
        id,
        req ? { status: req.fromId === meId ? 'outgoing' : 'incoming', requestId: req.id } : { status: 'none', requestId: null },
      );
    }
  }
  return result;
}

export async function relation(ctx: Ctx, meId: string, otherId: string): Promise<Relation> {
  return (await relationsTo(ctx, meId, [otherId])).get(otherId)!;
}

/** A user `meId` may see: exists, not banned, and hasn't blocked `meId`. */
export async function visibleUser(ctx: Ctx, meId: string, rawOtherId: string): Promise<UserRow> {
  const otherId = existingId(rawOtherId, userNotFound);
  const [other] = await ctx.db.select().from(users).where(eq(users.id, otherId));
  if (!other || other.bannedAt) throw userNotFound();
  const [theyBlocked] = await ctx.db
    .select()
    .from(blocks)
    .where(and(eq(blocks.blockerId, otherId), eq(blocks.blockedId, meId)));
  if (theyBlocked) throw userNotFound();
  return other;
}

/** The user whose profile `viewer` opens: themselves, or someone they may see. */
export async function profileSubject(ctx: Ctx, viewer: UserRow, id: string): Promise<UserRow> {
  return id === viewer.id ? viewer : visibleUser(ctx, viewer.id, id);
}

/** End a friendship and drop pending requests between the two, in either direction. */
export async function unfriend(ctx: Ctx, a: string, b: string) {
  const p = pair(a, b);
  await ctx.db.delete(friendships).where(and(eq(friendships.userA, p.userA), eq(friendships.userB, p.userB)));
  await ctx.db.delete(friendRequests).where(requestBetween(a, b));
}
