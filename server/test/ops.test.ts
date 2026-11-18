import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Daily } from '@shared/types';

import { createApp } from '../src/app';
import { submissions } from '../src/db/schema';
import { loadEnv } from '../src/env';
import { MAX_PHOTO_BYTES } from '../src/routes/game';
import { autoSchedule } from '../src/services/schedule';
import { localStorage } from '../src/services/storage';
import { requeuePending } from '../src/services/verification';
import { jpeg, startTestServer, type TestServer } from './helpers';

let t: TestServer;
beforeEach(async () => {
  t = await startTestServer();
});
afterEach(() => t.close());

type Auth = Record<string, string>;
const firstWord = async (auth: Auth) => ((await t.http().get('/daily').set(auth)).body as Daily).words[0]!;

describe('request ids and security headers', () => {
  it('gives every response an x-request-id and echoes a sane incoming one', async () => {
    const fresh = await t.http().get('/health');
    expect(fresh.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    const echoed = await t.http().get('/health').set('x-request-id', 'abc-123');
    expect(echoed.headers['x-request-id']).toBe('abc-123');
    // Junk (or log-injection attempts) is replaced, not echoed.
    const junk = await t.http().get('/health').set('x-request-id', 'a b\tc');
    expect(junk.headers['x-request-id']).not.toBe('a b\tc');
  });

  it('sets helmet headers but lets photos load cross-origin', async () => {
    const res = await t.http().get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });
});

describe('uploads', () => {
  it('answers 413 photo_too_large for an oversized photo', async () => {
    const a = await t.signIn('alex');
    const word = await firstWord(a.auth);
    const big = Buffer.concat([jpeg(), Buffer.alloc(MAX_PHOTO_BYTES + 1)]);
    const res = await t.http().post(`/words/${word.id}/submissions`).set(a.auth).attach('photo', big, 'photo.jpg');
    expect(res.status).toBe(413);
    expect(res.body.code).toBe('photo_too_large');
  });

  it('re-checks photos left pending by a restart', async () => {
    const a = await t.signIn('alex');
    const word = await firstWord(a.auth);
    const sent = await t.http().post(`/words/${word.id}/submissions`).set(a.auth).attach('photo', jpeg(), 'photo.jpg');
    expect(sent.body.status).toBe('valid');
    // Simulate a crash mid-check: the row is back to pending and nothing is queued.
    await t.ctx.db
      .update(submissions)
      .set({ status: 'pending', points: 0, rank: null, decidedAt: null })
      .where(eq(submissions.id, sent.body.id));

    expect(await requeuePending(t.ctx)).toBe(1);
    await t.ctx.queue.idle();
    const [row] = await t.ctx.db.select().from(submissions).where(eq(submissions.id, sent.body.id));
    expect(row!.status).toBe('valid');
    expect(await requeuePending(t.ctx)).toBe(0);
  });
});

describe('/files', () => {
  it('404s a correctly signed link to a missing file', async () => {
    const url = new URL(t.ctx.storage.signedUrl('nobody/missing.jpg'));
    const res = await t.http().get(url.pathname + url.search);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('not_found');
  });

  it('refuses a non-numeric expiry', async () => {
    const url = new URL(t.ctx.storage.signedUrl('a/b.jpg'));
    url.searchParams.set('exp', '1e99');
    expect((await t.http().get(url.pathname + url.search)).status).toBe(403);
  });

  it('is rate-limited on its own budget', async () => {
    const app = createApp(t.ctx);
    const url = new URL(t.ctx.storage.signedUrl('nobody/missing.jpg'));
    const get = () => request(app).get(url.pathname + url.search);
    let last = 0;
    for (let i = 0; i < 600; i++) last = (await get()).status;
    expect(last).toBe(404);
    const limited = await get();
    expect(limited.status).toBe(429);
    expect(limited.body.code).toBe('rate_limited');
    // Loading photos doesn't use up the API budget.
    expect((await request(app).get('/daily')).status).not.toBe(429);
  }, 60_000);
});

describe('local storage keys', () => {
  let dir: string;
  const store = () =>
    localStorage({ dir, baseUrl: 'http://x', secret: 's'.repeat(32), now: () => new Date('2026-11-14T00:00:00Z') });
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'storage-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('never touches files outside its folder', async () => {
    const s = store();
    for (const key of ['../evil.jpg', 'a/../../evil.jpg', '/etc/passwd.jpg', 'a/b.png', 'a//b.jpg']) {
      await expect(s.put(key, Buffer.from('x'))).rejects.toThrow('Bad storage key');
    }
    await expect(s.read('../outside.jpg')).rejects.toThrow('Bad storage key');
    await expect(s.delete('../')).rejects.toThrow('Bad storage key');
    await expect(s.delete('')).rejects.toThrow('Bad storage key');
    const signed = new URL(s.signedUrl('a/b.jpg'));
    expect(s.resolveSigned('../b.jpg', signed.searchParams.get('exp')!, signed.searchParams.get('sig')!)).toBeNull();
  });

  it('deletes one user prefix and leaves the others', async () => {
    const s = store();
    await s.put('u1/a.jpg', Buffer.from('1'));
    await s.put('u1/b.jpg', Buffer.from('2'));
    await s.put('u2/a.jpg', Buffer.from('3'));
    await s.delete('u1/');
    expect(existsSync(path.join(dir, 'u1'))).toBe(false);
    expect((await s.read('u2/a.jpg')).toString()).toBe('3');
    // Missing files are fine.
    await s.delete('u9/');
    mkdirSync(path.join(dir, 'u3'));
    writeFileSync(path.join(dir, 'u3', 'x.jpg'), 'x');
    await s.delete('u3/x.jpg');
    expect(existsSync(path.join(dir, 'u3', 'x.jpg'))).toBe(false);
  });
});

describe('AUTO_SCHEDULE', () => {
  const base = { JWT_SECRET: 'j'.repeat(32), FILE_URL_SECRET: 'f'.repeat(32) };

  it('is on only for the exact string "true"', () => {
    expect(loadEnv({ ...base, AUTO_SCHEDULE: 'true' }).AUTO_SCHEDULE).toBe(true);
    for (const v of ['1', 'TRUE', 'yes', '', undefined]) {
      expect(loadEnv({ ...base, AUTO_SCHEDULE: v }).AUTO_SCHEDULE).toBe(false);
    }
  });

  it('plans next month in the first week only, and never twice', async () => {
    t.setNow('2026-11-14T06:00:00Z');
    expect(await autoSchedule(t.ctx)).toBe(0);
    t.setNow('2026-12-03T06:00:00Z');
    const filled = await autoSchedule(t.ctx);
    expect(filled).toBe(31 * 4);
    expect(await autoSchedule(t.ctx)).toBe(0);
  });
});
