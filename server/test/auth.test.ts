import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import request from 'supertest';

import { createApp } from '../src/app';

import { startTestServer, type TestServer } from './helpers';

let t: TestServer;
beforeEach(async () => {
  t = await startTestServer();
});
afterEach(() => t.close());

describe('auth', () => {
  it('creates a user on first sign-in, finds them after', async () => {
    const first = await t.http().post('/auth/signin').send({ provider: 'google', idToken: 'dev:alex' });
    expect(first.status).toBe(200);
    expect(first.body.isNewUser).toBe(true);
    expect(first.body.user).toMatchObject({ username: null, isPremium: false });

    const again = await t.http().post('/auth/signin').send({ provider: 'google', idToken: 'dev:alex' });
    expect(again.body.isNewUser).toBe(false);
    expect(again.body.user.id).toBe(first.body.user.id);
  });

  it('rotates refresh tokens and rejects the old one', async () => {
    const { refreshToken } = await t.signIn('alex');
    const r1 = await t.http().post('/auth/refresh').send({ refreshToken });
    expect(r1.status).toBe(200);
    expect(r1.body.refreshToken).not.toBe(refreshToken);

    const reuse = await t.http().post('/auth/refresh').send({ refreshToken });
    expect(reuse.status).toBe(401);
    const next = await t.http().post('/auth/refresh').send({ refreshToken: r1.body.refreshToken });
    expect(next.status).toBe(200);
  });

  it('expires access tokens after 15 minutes', async () => {
    const short = await startTestServer({ ACCESS_TOKEN_TTL_SEC: '900' });
    try {
      const { auth } = await short.signIn('alex');
      expect((await short.http().get('/me').set(auth)).status).toBe(200);
      short.setNow('2026-11-14T06:16:00Z');
      const res = await short.http().get('/me').set(auth);
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('unauthorized');
    } finally {
      await short.close();
    }
  });

  it('sign-out revokes refresh tokens', async () => {
    const { auth, refreshToken } = await t.signIn('alex');
    expect((await t.http().post('/auth/signout').set(auth)).status).toBe(204);
    expect((await t.http().post('/auth/refresh').send({ refreshToken })).status).toBe(401);
  });

  it('rejects missing or garbage tokens', async () => {
    expect((await t.http().get('/me')).status).toBe(401);
    expect((await t.http().get('/me').set({ Authorization: 'Bearer nope' })).status).toBe(401);
  });

  it('rejects a non-JWT Apple token when dev login is off', async () => {
    const off = await startTestServer({ AUTH_DEV_LOGIN: 'false' });
    try {
      const res = await off.http().post('/auth/signin').send({ provider: 'apple', idToken: 'dev:alex' });
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('invalid_token');
    } finally {
      await off.close();
    }
  });

  it('validates and reserves usernames', async () => {
    const a = await t.signIn('alex', { username: false });
    const bad = await t.http().patch('/me').set(a.auth).send({ username: 'no spaces!' });
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe('invalid_username');

    const ok = await t.http().patch('/me').set(a.auth).send({ username: '  Hunter_1 ' });
    expect(ok.status).toBe(200);
    expect(ok.body.username).toBe('hunter_1');

    const b = await t.signIn('bob', { username: false });
    const taken = await t.http().patch('/me').set(b.auth).send({ username: 'hunter_1' });
    expect(taken.status).toBe(409);
    expect(taken.body.code).toBe('username_taken');
  });

  it('returns 426 for apps below MIN_APP_VERSION', async () => {
    const strict = await startTestServer({ MIN_APP_VERSION: '1.2.0' });
    try {
      const { auth } = await strict.signIn('alex');
      const old = await strict.http().get('/me').set(auth).set('X-App-Version', '1.1.9');
      expect(old.status).toBe(426);
      expect(old.body.code).toBe('upgrade_required');
      expect((await strict.http().get('/me').set(auth).set('X-App-Version', '1.2.0')).status).toBe(200);
    } finally {
      await strict.close();
    }
  });

  it('returns JSON errors for unknown routes and bad JSON', async () => {
    const missing = await t.http().get('/nope');
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ code: 'not_found', message: 'Not found.' });
    const bad = await t.http().post('/auth/signin').set('Content-Type', 'application/json').send('{oops');
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe('bad_request');
  });

  it('rate-limits /auth more tightly than the rest of the API', async () => {
    const app = createApp(t.ctx);
    const refresh = () => request(app).post('/auth/refresh').send({ refreshToken: 'nope' });
    for (let i = 0; i < 20; i++) expect((await refresh()).status).toBe(401);
    const limited = await refresh();
    expect(limited.status).toBe(429);
    expect(limited.body.code).toBe('rate_limited');
    // Other routes still have their own, larger budget.
    expect((await request(app).get('/daily')).status).not.toBe(429);
  });
});
