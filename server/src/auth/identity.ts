import { createRemoteJWKSet, jwtVerify } from 'jose';

import type { AuthRequest } from '@shared/types';

import type { Env } from '../env';
import { HttpError } from '../lib/errors';

/** Who the provider says signed in. */
export type Identity = {
  provider: 'apple' | 'google' | 'dev';
  sub: string;
  displayName: string | null;
};

const appleKeys = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));
const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

const invalid = () => new HttpError(401, 'invalid_token', "We couldn't verify your sign-in. Please try again.");

export async function verifyIdentity(env: Env, req: AuthRequest): Promise<Identity> {
  // Dev login: "dev:<name>" signs in as a test user. Never enabled in production (see env.ts).
  if (env.AUTH_DEV_LOGIN && req.idToken.startsWith('dev:')) {
    const name = req.idToken.slice(4).trim().toLowerCase();
    if (!/^[a-z0-9_]{1,20}$/.test(name)) throw new HttpError(400, 'bad_request', 'Dev login names use a-z, 0-9 and _.');
    return { provider: 'dev', sub: name, displayName: name };
  }

  if (req.provider === 'apple') {
    try {
      const { payload } = await jwtVerify(req.idToken, appleKeys, {
        issuer: 'https://appleid.apple.com',
        audience: env.APPLE_BUNDLE_ID,
      });
      if (!payload.sub) throw invalid();
      // Apple only sends the name on the very first sign-in, via the app.
      return { provider: 'apple', sub: payload.sub, displayName: req.fullName?.trim() || null };
    } catch (e) {
      if (e instanceof HttpError) throw e;
      throw invalid();
    }
  }

  if (!env.GOOGLE_WEB_CLIENT_ID) {
    throw new HttpError(500, 'server_error', 'Google sign-in is not configured on the server.');
  }
  try {
    const { payload } = await jwtVerify(req.idToken, googleKeys, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: env.GOOGLE_WEB_CLIENT_ID,
    });
    if (!payload.sub) throw invalid();
    return {
      provider: 'google',
      sub: payload.sub,
      displayName: typeof payload.name === 'string' ? payload.name : null,
    };
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw invalid();
  }
}
