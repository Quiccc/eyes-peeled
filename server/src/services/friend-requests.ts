import { and, desc, eq, or } from 'drizzle-orm';

import type { BlockedUser, FriendRequest, FriendsList } from '@shared/types';

import type { Ctx } from '../context';
import { blocks, friendRequests, friendships, users, type UserRow } from '../db/schema';
import { badRequest, notFound } from '../lib/errors';
import { toUser } from '../lib/present';
import { existingId, isUuid } from '../lib/validation';
import { blockedIds, pair, relation, unfriend, userNotFound, visibleUser } from './relationships';

/** Asking, accepting, declining, unfriending, blocking and unblocking. */

const requestNotFound = () => notFound('Request not found.');

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
    .map((r) => ({ id: r.req.id, from: toUser(r.from, ctx.storage), createdAt: r.req.createdAt.toISOString() }));
}

/** My friends (A–Z) and the requests I sent that are still pending (newest first). */
export async function friendsList(ctx: Ctx, me: UserRow): Promise<FriendsList> {
  const [blocked, friendRows, sentRows] = await Promise.all([
    blockedIds(ctx, me.id),
    ctx.db
      .select({ user: users, since: friendships.createdAt })
      .from(friendships)
      .innerJoin(
        users,
        or(
          and(eq(friendships.userA, me.id), eq(users.id, friendships.userB)),
          and(eq(friendships.userB, me.id), eq(users.id, friendships.userA)),
        ),
      ),
    ctx.db
      .select({ req: friendRequests, to: users })
      .from(friendRequests)
      .innerJoin(users, eq(users.id, friendRequests.toId))
      .where(eq(friendRequests.fromId, me.id))
      .orderBy(desc(friendRequests.createdAt)),
  ]);
  const visible = (u: UserRow) => !blocked.has(u.id) && !u.bannedAt;
  const nameKey = (u: UserRow) => (u.username ?? '').toLowerCase();
  return {
    friends: friendRows
      .filter((r) => visible(r.user))
      .sort((x, y) => nameKey(x.user).localeCompare(nameKey(y.user)))
      .map((r) => ({ user: toUser(r.user, ctx.storage), since: r.since.toISOString() })),
    sent: sentRows
      .filter((r) => visible(r.to))
      .map((r) => ({ id: r.req.id, to: toUser(r.to, ctx.storage), createdAt: r.req.createdAt.toISOString() })),
  };
}

/** Ask to be friends. If they already asked us, this accepts their request instead. */
export async function sendRequest(ctx: Ctx, me: UserRow, otherId: string): Promise<void> {
  if (otherId === me.id) throw badRequest("You can't add yourself.");
  await visibleUser(ctx, me.id, otherId);
  const rel = await relation(ctx, me.id, otherId);
  if (rel.status === 'blocked') throw badRequest('Unblock this player first.');
  if (rel.status === 'friends' || rel.status === 'outgoing') return;
  if (rel.status === 'incoming' && rel.requestId) {
    await accept(ctx, me, rel.requestId);
    return;
  }
  await ctx.db.insert(friendRequests).values({ fromId: me.id, toId: otherId }).onConflictDoNothing();
}

export async function respond(ctx: Ctx, me: UserRow, requestId: string, action: 'accept' | 'decline') {
  if (action === 'accept') return accept(ctx, me, requestId);
  if (!isUuid(requestId)) return; // can't exist, so there's nothing to decline
  await ctx.db.delete(friendRequests).where(and(eq(friendRequests.id, requestId), eq(friendRequests.toId, me.id)));
}

async function accept(ctx: Ctx, me: UserRow, rawRequestId: string) {
  const requestId = existingId(rawRequestId, requestNotFound);
  await ctx.db.transaction(async (tx) => {
    const [req] = await tx
      .delete(friendRequests)
      .where(and(eq(friendRequests.id, requestId), eq(friendRequests.toId, me.id)))
      .returning();
    if (!req) throw requestNotFound();
    await tx.insert(friendships).values(pair(req.fromId, req.toId)).onConflictDoNothing();
  });
}

/** Remove a friend, or cancel/decline a request in either direction. */
export async function removeFriend(ctx: Ctx, me: UserRow, otherId: string) {
  await unfriend(ctx, me.id, otherId);
}

/** Block: they disappear from each other's feeds, boards and search, and any friendship ends. */
export async function block(ctx: Ctx, me: UserRow, rawOtherId: string) {
  if (rawOtherId === me.id) throw badRequest("You can't block yourself.");
  const otherId = existingId(rawOtherId, userNotFound);
  const [other] = await ctx.db.select({ id: users.id }).from(users).where(eq(users.id, otherId));
  if (!other) throw userNotFound();
  await ctx.db.insert(blocks).values({ blockerId: me.id, blockedId: otherId }).onConflictDoNothing();
  await unfriend(ctx, me.id, otherId);
}

/** Unblock. They see each other again; the friendship that block() ended doesn't come back. */
export async function unblock(ctx: Ctx, me: UserRow, otherId: string) {
  await ctx.db.delete(blocks).where(and(eq(blocks.blockerId, me.id), eq(blocks.blockedId, otherId)));
}

/** Players I blocked, most recent first. Banned players are hidden, as everywhere else. */
export async function blockedUsers(ctx: Ctx, me: UserRow): Promise<BlockedUser[]> {
  const rows = await ctx.db
    .select({ user: users, blockedAt: blocks.createdAt })
    .from(blocks)
    .innerJoin(users, eq(users.id, blocks.blockedId))
    .where(eq(blocks.blockerId, me.id))
    .orderBy(desc(blocks.createdAt));
  return rows
    .filter((r) => !r.user.bannedAt)
    .map((r) => ({ user: toUser(r.user, ctx.storage), blockedAt: r.blockedAt.toISOString() }));
}
