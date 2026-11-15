import { eq } from 'drizzle-orm';

import type { Ctx } from '../context';
import { users, type UserRow } from '../db/schema';
import { HttpError } from '../lib/errors';
import { isUniqueViolation } from '../lib/sql';
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
    if (isUniqueViolation(e)) throw new HttpError(409, 'username_taken', 'That username is taken.');
    throw e;
  }
}

/** Delete the account and everything it owns. Required by the App Store. */
export async function deleteAccount(ctx: Ctx, user: UserRow): Promise<void> {
  // TODO(apple): revoking the Apple token needs the app to send Apple's authorizationCode
  // (exchange it at https://appleid.apple.com/auth/token, then POST /auth/revoke). Not sent yet.
  await deleteCustomer(ctx, user.id);
  // Cascades to submissions, tokens, friendships, requests and blocks.
  await ctx.db.delete(users).where(eq(users.id, user.id));
  await ctx.storage.delete(`${user.id}/`);
}
