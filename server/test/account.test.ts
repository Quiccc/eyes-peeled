import { readdirSync } from 'node:fs';

import { eq } from 'drizzle-orm';
import { decodeProtectedHeader, exportPKCS8, generateKeyPair, decodeJwt } from 'jose';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { users } from '../src/db/schema';
import { jpeg, startTestServer, type TestServer } from './helpers';

let t: TestServer;
afterEach(async () => {
  vi.unstubAllGlobals();
  await t.close();
});

async function appleEnv() {
  const { privateKey } = await generateKeyPair('ES256', { extractable: true });
  // Stored on one line in .env, as the docs say.
  const pem = (await exportPKCS8(privateKey)).replace(/\n/g, '\\n');
  return { APPLE_TEAM_ID: 'TEAM123456', APPLE_KEY_ID: 'KEY1234567', APPLE_PRIVATE_KEY: pem };
}

type AppleCall = { path: string; form: URLSearchParams };

/** Stub Apple's token endpoints; everything else (none expected) fails the test. */
function stubApple(opts: { down?: boolean } = {}) {
  const calls: AppleCall[] = [];
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    const u = new URL(url);
    expect(u.origin).toBe('https://appleid.apple.com');
    calls.push({ path: u.pathname, form: new URLSearchParams(init.body as URLSearchParams) });
    if (opts.down) return new Response('nope', { status: 503 });
    if (u.pathname === '/auth/token') return Response.json({ access_token: 'at', refresh_token: 'rt-123' });
    return new Response(null, { status: 200 });
  });
  return calls;
}

async function appleUser(name: string) {
  const u = await t.signIn(name);
  await t.ctx.db.update(users).set({ provider: 'apple' }).where(eq(users.id, u.id));
  return u;
}

const remaining = async () => (await t.ctx.db.select({ id: users.id }).from(users)).length;

describe('account deletion', () => {
  it('revokes the Apple token with the code the app sends', async () => {
    t = await startTestServer(await appleEnv());
    const calls = stubApple();
    const a = await appleUser('alex');
    const res = await t.http().delete('/me').set(a.auth).send({ appleAuthorizationCode: 'code-xyz' });
    expect(res.status).toBe(204);

    expect(calls.map((c) => c.path)).toEqual(['/auth/token', '/auth/revoke']);
    const [token, revoke] = calls as [AppleCall, AppleCall];
    expect(token.form.get('grant_type')).toBe('authorization_code');
    expect(token.form.get('code')).toBe('code-xyz');
    expect(token.form.get('client_id')).toBe('com.eyespeeled.app');
    const secret = token.form.get('client_secret')!;
    expect(decodeProtectedHeader(secret)).toMatchObject({ alg: 'ES256', kid: 'KEY1234567' });
    expect(decodeJwt(secret)).toMatchObject({
      iss: 'TEAM123456',
      sub: 'com.eyespeeled.app',
      aud: 'https://appleid.apple.com',
    });
    expect(revoke.form.get('token')).toBe('rt-123');
    expect(revoke.form.get('token_type_hint')).toBe('refresh_token');
    expect(await remaining()).toBe(0);
  });

  it('still deletes the account when Apple is down', async () => {
    t = await startTestServer(await appleEnv());
    const calls = stubApple({ down: true });
    const a = await appleUser('alex');
    const word = ((await t.http().get('/daily').set(a.auth)).body as { words: { id: string }[] }).words[0]!;
    await t.http().post(`/words/${word.id}/submissions`).set(a.auth).attach('photo', jpeg(), 'photo.jpg');

    expect((await t.http().delete('/me').set(a.auth).send({ appleAuthorizationCode: 'c' })).status).toBe(204);
    expect(calls).toHaveLength(1);
    expect(await remaining()).toBe(0);
    expect(readdirSync(t.storageDir)).toEqual([]);
  });

  it('skips revocation when the Apple key is not configured, or for non-Apple users', async () => {
    t = await startTestServer();
    const calls = stubApple();
    const a = await appleUser('alex');
    expect((await t.http().delete('/me').set(a.auth).send({ appleAuthorizationCode: 'c' })).status).toBe(204);
    const g = await t.signIn('gina');
    expect((await t.http().delete('/me').set(g.auth)).status).toBe(204);
    expect(calls).toEqual([]);
    expect(await remaining()).toBe(0);
  });

  it('rejects a malformed body', async () => {
    t = await startTestServer();
    const a = await t.signIn('alex');
    const res = await t.http().delete('/me').set(a.auth).send({ appleAuthorizationCode: 42 });
    expect(res.status).toBe(400);
    expect(await remaining()).toBe(1);
  });
});
