import { and, eq } from 'drizzle-orm';

import type { Identity } from '../auth/identity';
import type { Ctx } from '../context';
import { users, type UserRow } from '../db/schema';
import { banned } from '../lib/errors';

export async function findUser(ctx: Ctx, id: string): Promise<UserRow | null> {
  const [user] = await ctx.db.select().from(users).where(eq(users.id, id));
  return user ?? null;
}

/**
 * Find or create the account for a verified Apple/Google identity. Google sends the current name on
 * every sign-in (its profile picture isn't used: players upload their own); Apple sends the name only the first time, so it's never overwritten.
 * Banned accounts can't sign in.
 */
export async function signInUser(ctx: Ctx, id: Identity): Promise<{ user: UserRow; isNewUser: boolean }> {
  const [existing] = await ctx.db
    .select()
    .from(users)
    .where(and(eq(users.provider, id.provider), eq(users.providerSub, id.sub)));

  let user = existing;
  if (!user) {
    [user] = await ctx.db
      .insert(users)
      .values({ provider: id.provider, providerSub: id.sub, displayName: id.displayName })
      .returning();
  } else if (id.provider === 'google' || (id.displayName && !user.displayName)) {
    [user] = await ctx.db
      .update(users)
      .set({ displayName: id.displayName ?? user.displayName })
      .where(eq(users.id, user.id))
      .returning();
  }
  if (!user) throw new Error('sign-in upsert failed');
  if (user.bannedAt) throw banned();
  return { user, isNewUser: !existing };
}
