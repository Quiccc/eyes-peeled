import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';

import type { Ctx } from '../context';
import { users, type UserRow } from '../db/schema';
import { HttpError, notFound } from '../lib/errors';
import { isUniqueViolation } from '../lib/sql';
import { revokeAppleToken } from './apple-revoke';
import { deleteCustomer } from './revenuecat';

/** Lowercase letters, digits and underscores, 3–20 long. The app checks the same rule. */
const USERNAME = /^[a-z0-9_]{3,20}$/;

export async function setUsername(ctx: Ctx, user: UserRow, username: string): Promise<UserRow> {
  const clean = username.trim().toLowerCase();
  if (!USERNAME.test(clean)) {
    throw new HttpError(400, 'invalid_username', 'Use 3–20 letters, numbers or underscores.');
  }
  try {
    const [row] = await ctx.db.update(users).set({ username: clean }).where(eq(users.id, user.id)).returning();
    if (!row) throw new Error('user vanished');
    return row;
  } catch (e) {
    if (isUniqueViolation(e)) throw new HttpError(409, 'username_taken', 'That username is taken. Try another one.');
    throw e;
  }
}

/** Store a new profile picture (a JPEG the app already cropped and shrank) and drop the old one. */
export async function setAvatar(ctx: Ctx, user: UserRow, jpeg: Buffer): Promise<UserRow> {
  const key = `${user.id}/avatar-${randomUUID()}.jpg`;
  await ctx.storage.put(key, jpeg);
  const [row] = await ctx.db.update(users).set({ avatarKey: key }).where(eq(users.id, user.id)).returning();
  if (!row) {
    await ctx.storage.delete(key);
    throw notFound('User not found.');
  }
  if (user.avatarKey) await ctx.storage.delete(user.avatarKey);
  return row;
}

/** Remove the uploaded picture. The app shows their initial instead. */
export async function clearAvatar(ctx: Ctx, userId: string): Promise<UserRow> {
  const [old] = await ctx.db.select({ avatarKey: users.avatarKey }).from(users).where(eq(users.id, userId));
  if (!old) throw notFound('User not found.');
  const [row] = await ctx.db.update(users).set({ avatarKey: null }).where(eq(users.id, userId)).returning();
  if (!row) throw notFound('User not found.');
  if (old.avatarKey) await ctx.storage.delete(old.avatarKey);
  return row;
}

/**
 * Delete the account and everything it owns. Required by the App Store. Apple accounts also get
 * their Sign in with Apple token revoked, from the fresh authorization code the app sends.
 */
export async function deleteAccount(
  ctx: Ctx,
  user: UserRow,
  opts: { appleAuthorizationCode?: string } = {},
): Promise<void> {
  if (user.provider === 'apple' && opts.appleAuthorizationCode) {
    await revokeAppleToken(ctx.env, opts.appleAuthorizationCode);
  }
  await deleteCustomer(ctx, user.id);
  // Cascades to submissions, tokens, friendships, requests and blocks.
  await ctx.db.delete(users).where(eq(users.id, user.id));
  await ctx.storage.delete(`${user.id}/`);
}
