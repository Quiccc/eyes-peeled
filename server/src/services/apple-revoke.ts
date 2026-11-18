import { importPKCS8, SignJWT } from 'jose';

import type { Env } from '../env';
import { logger } from '../lib/logger';

const APPLE = 'https://appleid.apple.com';

type AppleKeyEnv = Pick<Env, 'APPLE_BUNDLE_ID' | 'APPLE_TEAM_ID' | 'APPLE_KEY_ID' | 'APPLE_PRIVATE_KEY'>;

export const appleRevocationConfigured = (env: AppleKeyEnv) =>
  Boolean(env.APPLE_TEAM_ID && env.APPLE_KEY_ID && env.APPLE_PRIVATE_KEY);

/** The client_secret Apple's token endpoints want: an ES256 JWT signed with the Sign in with Apple key. */
async function clientSecret(env: AppleKeyEnv): Promise<string> {
  const key = await importPKCS8(env.APPLE_PRIVATE_KEY!.replace(/\\n/g, '\n'), 'ES256');
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: env.APPLE_KEY_ID! })
    .setIssuer(env.APPLE_TEAM_ID!)
    .setSubject(env.APPLE_BUNDLE_ID)
    .setAudience(APPLE)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(key);
}

async function post(path: string, form: Record<string, string>): Promise<Response> {
  const res = await fetch(`${APPLE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Apple ${path} answered ${res.status}: ${await res.text().catch(() => '')}`);
  return res;
}

/**
 * Account deletion for Sign in with Apple users (App Store Review Guideline 5.1.1(v)): trade the
 * app's fresh authorization code for a refresh token, then revoke it. Best effort: a failure is
 * logged and the account is still deleted.
 */
export async function revokeAppleToken(env: AppleKeyEnv, authorizationCode: string): Promise<boolean> {
  if (!appleRevocationConfigured(env)) {
    logger.warn('Apple token not revoked: APPLE_TEAM_ID, APPLE_KEY_ID or APPLE_PRIVATE_KEY is not set');
    return false;
  }
  try {
    const secret = await clientSecret(env);
    const tokenRes = await post('/auth/token', {
      client_id: env.APPLE_BUNDLE_ID,
      client_secret: secret,
      code: authorizationCode,
      grant_type: 'authorization_code',
    });
    const { refresh_token: refreshToken, access_token: accessToken } = (await tokenRes.json()) as {
      refresh_token?: string;
      access_token?: string;
    };
    const token = refreshToken ?? accessToken;
    if (!token) throw new Error('Apple returned no token to revoke');
    await post('/auth/revoke', {
      client_id: env.APPLE_BUNDLE_ID,
      client_secret: secret,
      token,
      token_type_hint: refreshToken ? 'refresh_token' : 'access_token',
    });
    return true;
  } catch (err) {
    logger.warn({ err }, 'Apple token revocation failed');
    return false;
  }
}
