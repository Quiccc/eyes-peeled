import { inArray, sql } from 'drizzle-orm';

import type { Leaderboard, LeaderboardEntry, LeaderboardScope } from '@shared/types';

import type { Ctx } from '../context';
import { users, type UserRow } from '../db/schema';
import { toUser } from '../lib/present';
import { rowsOf } from '../lib/sql';
import { monthStartUtc, nextMonthStartUtc, utcMonth } from '../lib/time';
import { friendIds } from './relationships';

const PAGE_SIZE = 20;

type Ranked = { user_id: string; points: number; rank: number };

/**
 * Monthly board. Points = this month's valid finds plus their combo bonuses. Ties go to whoever reached their total first
 * (earliest latest-find), then user id, so ranks are stable across pages.
 */
function rankedQuery(ctx: Ctx, me: UserRow, scope: LeaderboardScope, memberIds: string[]) {
  const now = ctx.clock.now();
  const from = monthStartUtc(now).toISOString();
  const to = nextMonthStartUtc(now).toISOString();
  const members = sql.join(
    memberIds.map((id) => sql`${id}::uuid`),
    sql`, `,
  );
  return sql`
    WITH scores AS (
      SELECT s.user_id, SUM(s.points + s.combo_points)::int AS points, MAX(s.received_at) AS last_at
      FROM submissions s
      WHERE s.status = 'valid' AND s.received_at >= ${from}::timestamptz AND s.received_at < ${to}::timestamptz
      GROUP BY s.user_id
    ),
    pool AS (
      SELECT u.id AS user_id, COALESCE(sc.points, 0) AS points, sc.last_at
      FROM users u
      LEFT JOIN scores sc ON sc.user_id = u.id
      WHERE u.banned_at IS NULL
        AND u.username IS NOT NULL
        AND ${scope === 'friends' ? sql`u.id IN (${members})` : sql`sc.user_id IS NOT NULL`}
        AND NOT EXISTS (
          SELECT 1 FROM blocks b
          WHERE (b.blocker_id = ${me.id}::uuid AND b.blocked_id = u.id)
             OR (b.blocker_id = u.id AND b.blocked_id = ${me.id}::uuid)
        )
    )
    SELECT user_id, points, (ROW_NUMBER() OVER (ORDER BY points DESC, last_at ASC NULLS LAST, user_id))::int AS rank
    FROM pool
  `;
}

export async function getLeaderboard(
  ctx: Ctx,
  me: UserRow,
  scope: LeaderboardScope,
  /** Offset from the previous page's nextCursor (validated digits), or none for the first page. */
  cursor: string | undefined,
): Promise<Leaderboard> {
  const now = ctx.clock.now();
  const offset = cursor ? Number(cursor) : 0;
  const members = scope === 'friends' ? [me.id, ...(await friendIds(ctx, me.id))] : [];
  const ranked = rankedQuery(ctx, me, scope, members);

  const page = rowsOf<Ranked>(
    await ctx.db.execute(sql`SELECT * FROM (${ranked}) r ORDER BY rank LIMIT ${PAGE_SIZE + 1} OFFSET ${offset}`),
  );
  const [mine] = rowsOf<Ranked>(await ctx.db.execute(sql`SELECT * FROM (${ranked}) r WHERE user_id = ${me.id}::uuid`));

  const shown = page.slice(0, PAGE_SIZE);
  const ids = [...new Set([...shown.map((r) => r.user_id), ...(mine ? [me.id] : [])])];
  const people = ids.length ? await ctx.db.select().from(users).where(inArray(users.id, ids)) : [];
  const byId = new Map(people.map((u) => [u.id, u]));
  const entry = (r: Ranked): LeaderboardEntry | null => {
    const u = byId.get(r.user_id);
    return u ? { rank: Number(r.rank), user: toUser(u), points: Number(r.points) } : null;
  };

  return {
    month: utcMonth(now),
    resetsAt: nextMonthStartUtc(now).toISOString(),
    entries: shown.map(entry).filter((e): e is LeaderboardEntry => e !== null),
    me: mine ? entry(mine) : null,
    nextCursor: page.length > PAGE_SIZE ? String(offset + PAGE_SIZE) : null,
  };
}

/** The user's own month points and global rank (rank null with 0 points). */
export async function monthStanding(ctx: Ctx, me: UserRow, userId: string) {
  const ranked = rankedQuery(ctx, me, 'global', []);
  const [row] = rowsOf<Ranked>(await ctx.db.execute(sql`SELECT * FROM (${ranked}) r WHERE user_id = ${userId}::uuid`));
  return { monthPoints: row ? Number(row.points) : 0, monthRank: row ? Number(row.rank) : null };
}
