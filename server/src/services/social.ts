import { and, desc, eq, ilike, inArray, ne, or, isNotNull } from 'drizzle-orm';

import type { FeedItem, FriendRequest, FriendStatus, UserSearchResult } from '@shared/types';

import type { Ctx } from '../context';
import { blocks, friendRequests, friendships, users, type UserRow } from '../db/schema';
import { HttpError, notFound } from '../lib/errors';
import { toFeedItem, toUser } from '../lib/present';

import { dailyWordInfo } from './daily-words';
import { validToday } from './submissions';

const pair = (a: string, b: string) => (a < b ? { userA: a, userB: b } : { userA: b, userB: a });

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

export async function areFriends(ctx: Ctx, a: string, b: string): Promise<boolean> {
  const p = pair(a, b);
  const [row] = await ctx.db
    .select()
    .from(friendships)
    .where(and(eq(friendships.userA, p.userA), eq(friendships.userB, p.userB)));
  return !!row;
}

/** Relationship from `me`'s side, plus the pending request id if any. */
export async function relation(ctx: Ctx, meId: string, otherId: string): Promise<{ status: FriendStatus; requestId: string | null }> {
  const [iBlocked] = await ctx.db
    .select()
    .from(blocks)
    .where(and(eq(blocks.blockerId, meId), eq(blocks.blockedId, otherId)));
  if (iBlocked) return { status: 'blocked', requestId: null };
  if (await areFriends(ctx, meId, otherId)) return { status: 'friends', requestId: null };
  const [req] = await ctx.db
    .select()
    .from(friendRequests)
    .where(
      or(
        and(eq(friendRequests.fromId, meId), eq(friendRequests.toId, otherId)),
        and(eq(friendRequests.fromId, otherId), eq(friendRequests.toId, meId)),
      ),
    );
  if (req) return { status: req.fromId === meId ? 'outgoing' : 'incoming', requestId: req.id };
  return { status: 'none', requestId: null };
}

/** A user `me` may see: exists, not banned, and hasn't blocked `me`. */
export async function visibleUser(ctx: Ctx, meId: string, otherId: string): Promise<UserRow> {
  if (!/^[0-9a-f-]{36}$/i.test(otherId)) throw notFound('User not found.');
  const [other] = await ctx.db.select().from(users).where(eq(users.id, otherId));
  if (!other || other.bannedAt) throw notFound('User not found.');
  const [theyBlocked] = await ctx.db
    .select()
    .from(blocks)
    .where(and(eq(blocks.blockerId, otherId), eq(blocks.blockedId, meId)));
  if (theyBlocked) throw notFound('User not found.');
  return other;
}

// ---- feed ---------------------------------------------------------------------

export async function feedToday(ctx: Ctx, me: UserRow): Promise<FeedItem[]> {
  const blocked = await blockedIds(ctx, me.id);
  const ids = (await friendIds(ctx, me.id)).filter((id) => !blocked.has(id));
  return todaysFinds(ctx, ids);
}

/** Valid finds today by these users, newest first. */
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

// ---- friend requests ---------------------------------------------------------

export async function incomingRequests(ctx: Ctx, me: UserRow): Promise<FriendRequest[]> {
  const blocked = await blockedIds(ctx, me.id);
  const rows = await ctx.db
    .select({ req: friendRequests, from: users })
    .from(friendRequests)
    .innerJoin(users, eq(users.id, friendRequests.fromId))
    .where(eq(friendRequests.toId, me.id))
    .orderBy(desc(friendRequests.createdAt));
  return rows
    .filter((r) => !blocked.has(r.from.id) && !r.from.bannedAt)
    .map((r) => ({ id: r.req.id, from: toUser(r.from), createdAt: r.req.createdAt.toISOString() }));
}

export async function sendRequest(ctx: Ctx, me: UserRow, otherId: string): Promise<void> {
  if (otherId === me.id) throw new HttpError(400, 'bad_request', "You can't add yourself.");
  await visibleUser(ctx, me.id, otherId);
  const rel = await relation(ctx, me.id, otherId);
  if (rel.status === 'blocked') throw new HttpError(400, 'bad_request', 'Unblock this player first.');
  if (rel.status === 'friends' || rel.status === 'outgoing') return;
  if (rel.status === 'incoming' && rel.requestId) {
    await accept(ctx, me, rel.requestId);
    return;
  }
  await ctx.db.insert(friendRequests).values({ fromId: me.id, toId: otherId }).onConflictDoNothing();
}

export async function respond(ctx: Ctx, me: UserRow, requestId: string, action: 'accept' | 'decline') {
  if (action === 'accept') return accept(ctx, me, requestId);
  await ctx.db.delete(friendRequests).where(and(eq(friendRequests.id, requestId), eq(friendRequests.toId, me.id)));
}

async function accept(ctx: Ctx, me: UserRow, requestId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) throw notFound('Request not found.');
  await ctx.db.transaction(async (tx) => {
    const [req] = await tx
      .delete(friendRequests)
      .where(and(eq(friendRequests.id, requestId), eq(friendRequests.toId, me.id)))
      .returning();
    if (!req) throw notFound('Request not found.');
    await tx.insert(friendships).values(pair(req.fromId, req.toId)).onConflictDoNothing();
  });
}

/** Remove a friend, or cancel/decline a request in either direction. */
export async function removeFriend(ctx: Ctx, me: UserRow, otherId: string) {
  const p = pair(me.id, otherId);
  await ctx.db.delete(friendships).where(and(eq(friendships.userA, p.userA), eq(friendships.userB, p.userB)));
  await clearRequests(ctx, me.id, otherId);
}

async function clearRequests(ctx: Ctx, a: string, b: string) {
  await ctx.db
    .delete(friendRequests)
    .where(
      or(
        and(eq(friendRequests.fromId, a), eq(friendRequests.toId, b)),
        and(eq(friendRequests.fromId, b), eq(friendRequests.toId, a)),
      ),
    );
}

export async function block(ctx: Ctx, me: UserRow, otherId: string) {
  if (otherId === me.id) throw new HttpError(400, 'bad_request', "You can't block yourself.");
  if (!/^[0-9a-f-]{36}$/i.test(otherId)) throw notFound('User not found.');
  const [other] = await ctx.db.select({ id: users.id }).from(users).where(eq(users.id, otherId));
  if (!other) throw notFound('User not found.');
  await ctx.db.insert(blocks).values({ blockerId: me.id, blockedId: otherId }).onConflictDoNothing();
  const p = pair(me.id, otherId);
  await ctx.db.delete(friendships).where(and(eq(friendships.userA, p.userA), eq(friendships.userB, p.userB)));
  await clearRequests(ctx, me.id, otherId);
}

// ---- search -----------------------------------------------------------------------

export async function search(ctx: Ctx, me: UserRow, q: string): Promise<UserSearchResult[]> {
  const needle = q.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (!needle) return [];
  const blocked = await blockedIds(ctx, me.id);
  const rows = await ctx.db
    .select()
    .from(users)
    .where(and(ilike(users.username, `${needle}%`), ne(users.id, me.id), isNotNull(users.username)))
    .orderBy(users.username)
    .limit(25);
  const results: UserSearchResult[] = [];
  for (const u of rows) {
    if (blocked.has(u.id) || u.bannedAt) continue;
    results.push({ user: toUser(u), friendStatus: (await relation(ctx, me.id, u.id)).status });
  }
  return results;
}
