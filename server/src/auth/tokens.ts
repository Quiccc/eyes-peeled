import { createHash, randomBytes } from 'node:crypto';

import { and, eq, gt, isNull } from 'drizzle-orm';
import { jwtVerify, SignJWT } from 'jose';

import type { Ctx } from '../context';
import { refreshTokens } from '../db/schema';

const REFRESH_TTL_MS = 60 * 86_400_000;

const key = (secret: string) => new TextEncoder().encode(secret);
const hash = (token: string) => createHash('sha256').update(token).digest('hex');

export async function signAccessToken(ctx: Ctx, userId: string): Promise<string> {
  const now = Math.floor(ctx.clock.now().getTime() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt(now)
    .setExpirationTime(now + ctx.env.ACCESS_TOKEN_TTL_SEC)
    .sign(key(ctx.env.JWT_SECRET));
}

/** The user id in a valid access token, or null. */
export async function verifyAccessToken(ctx: Ctx, token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, key(ctx.env.JWT_SECRET), {
      algorithms: ['HS256'],
      currentDate: ctx.clock.now(),
    });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

/** A new opaque refresh token. Only its hash is stored. */
export async function issueRefreshToken(ctx: Ctx, userId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await ctx.db.insert(refreshTokens).values({
    userId,
    tokenHash: hash(token),
    expiresAt: new Date(ctx.clock.now().getTime() + REFRESH_TTL_MS),
  });
  return token;
}

export async function issueTokens(ctx: Ctx, userId: string) {
  return {
    accessToken: await signAccessToken(ctx, userId),
    refreshToken: await issueRefreshToken(ctx, userId),
  };
}

/** Swap a valid refresh token for a new pair (the old one is revoked). null when invalid. */
export async function rotateRefreshToken(ctx: Ctx, token: string) {
  const now = ctx.clock.now();
  const [row] = await ctx.db
    .update(refreshTokens)
    .set({ revokedAt: now })
    .where(
      and(eq(refreshTokens.tokenHash, hash(token)), isNull(refreshTokens.revokedAt), gt(refreshTokens.expiresAt, now)),
    )
    .returning();
  if (!row) return null;
  return { userId: row.userId, tokens: await issueTokens(ctx, row.userId) };
}

/** Revoke one refresh token, or all of a user's tokens when none is given. */
export async function revokeRefreshTokens(ctx: Ctx, userId: string, token?: string) {
  const now = ctx.clock.now();
  await ctx.db
    .update(refreshTokens)
    .set({ revokedAt: now })
    .where(
      and(
        eq(refreshTokens.userId, userId),
        isNull(refreshTokens.revokedAt),
        token ? eq(refreshTokens.tokenHash, hash(token)) : undefined,
      ),
    );
}
