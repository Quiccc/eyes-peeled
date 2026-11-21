import { and, ilike, isNotNull, ne } from 'drizzle-orm';

import type { UserSearchResult } from '@shared/types';

import type { Ctx } from '../context';
import { users, type UserRow } from '../db/schema';
import { toUser } from '../lib/present';
import { blockedIds, relationsTo } from './relationships';

const SEARCH_LIMIT = 25;

/** Username prefix search, without the searcher, banned users and anyone blocked either way. */
export async function search(ctx: Ctx, me: UserRow, q: string): Promise<UserSearchResult[]> {
  const needle = q.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (!needle) return [];
  const blocked = await blockedIds(ctx, me.id);
  const rows = await ctx.db
    .select()
    .from(users)
    .where(and(ilike(users.username, `${needle}%`), ne(users.id, me.id), isNotNull(users.username)))
    .orderBy(users.username)
    .limit(SEARCH_LIMIT);
  const shown = rows.filter((u) => !blocked.has(u.id) && !u.bannedAt);
  const relations = await relationsTo(
    ctx,
    me.id,
    shown.map((u) => u.id),
  );
  return shown.map((u) => ({ user: toUser(u, ctx.storage), friendStatus: relations.get(u.id)!.status }));
}
