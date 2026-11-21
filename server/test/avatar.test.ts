import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type { User, UserProfile } from '@shared/types';

import { MAX_AVATAR_BYTES } from '../src/routes/me';
import { jpeg, startTestServer, type TestServer } from './helpers';

const ADMIN = { Authorization: 'Bearer test-admin-token' };

let t: TestServer;
afterEach(async () => {
  await t.close();
});

type Player = Awaited<ReturnType<TestServer['signIn']>>;

const upload = (p: Player, body = jpeg()) => t.http().put('/me/avatar').set(p.auth).attach('photo', body, 'avatar.jpg');

/** The storage key behind a signed /files URL. */
const keyOf = (url: string) => new URL(url).pathname.replace(/^\/files\//, '');
const stored = (url: string) => existsSync(path.join(t.storageDir, keyOf(url)));

describe('profile pictures', () => {
  it('stores the picture and shows it wherever the player appears', async () => {
    t = await startTestServer();
    const a = await t.signIn('alex');
    const b = await t.signIn('bea');
    await t.http().post('/friends/requests').set(a.auth).send({ userId: b.id });
    await t.http().post('/friends/requests').set(b.auth).send({ userId: a.id });

    const res = await upload(a);
    expect(res.status).toBe(200);
    const url = (res.body as User).avatarUrl!;
    expect(url).toMatch(/^http:\/\/test\.local\/files\/.+\/avatar-.+\.jpg\?exp=\d+&sig=/);
    expect(stored(url)).toBe(true);

    // The link loads, and lasts at least a week, ending at a UTC midnight so it stays the same all day.
    const file = await t.http().get(new URL(url).pathname + new URL(url).search);
    expect(file.status).toBe(200);
    const exp = Number(new URL(url).searchParams.get('exp'));
    expect(exp % 86_400).toBe(0);
    expect(exp * 1000 - t.ctx.clock.now().getTime()).toBeGreaterThanOrEqual(7 * 86_400_000);
    t.setNow('2026-11-14T20:00:00Z');
    expect(((await t.http().get('/me').set(a.auth)).body as User).avatarUrl).toBe(url);

    expect(((await t.http().get(`/users/${a.id}`).set(b.auth)).body as UserProfile).user.avatarUrl).toBe(url);
    const search = (await t.http().get('/users/search?q=al').set(b.auth)).body as { user: User }[];
    expect(search[0]!.user.avatarUrl).toBe(url);
  });

  it('replaces the old file, and removing goes back to no picture', async () => {
    t = await startTestServer();
    const a = await t.signIn('alex');

    const first = ((await upload(a)).body as User).avatarUrl!;
    const second = ((await upload(a)).body as User).avatarUrl!;
    expect(keyOf(second)).not.toBe(keyOf(first));
    expect(stored(first)).toBe(false);
    expect(stored(second)).toBe(true);

    const res = await t.http().delete('/me/avatar').set(a.auth);
    expect(res.status).toBe(200);
    expect((res.body as User).avatarUrl).toBeNull();
    expect(stored(second)).toBe(false);
    // Removing again is fine.
    expect((await t.http().delete('/me/avatar').set(a.auth)).status).toBe(200);
  });

  it('rejects a missing, non-JPEG or oversized picture', async () => {
    t = await startTestServer();
    const a = await t.signIn('alex');
    expect((await t.http().put('/me/avatar').set(a.auth)).status).toBe(400);
    expect((await upload(a, Buffer.from('not a jpeg'))).status).toBe(400);
    const big = await upload(a, Buffer.concat([jpeg(), Buffer.alloc(MAX_AVATAR_BYTES)]));
    expect(big.status).toBe(413);
    expect(big.body).toMatchObject({ code: 'photo_too_large' });
    expect(((await t.http().get('/me').set(a.auth)).body as User).avatarUrl).toBeNull();
  });

  it('needs a signed-in player', async () => {
    t = await startTestServer();
    expect((await t.http().put('/me/avatar').attach('photo', jpeg(), 'a.jpg')).status).toBe(401);
    expect((await t.http().delete('/me/avatar')).status).toBe(401);
  });

  it('goes with the account', async () => {
    t = await startTestServer();
    const a = await t.signIn('alex');
    await upload(a);
    expect((await t.http().delete('/me').set(a.auth)).status).toBe(204);
    expect(readdirSync(t.storageDir)).toEqual([]);
  });

  it('can be removed by a moderator from a report', async () => {
    t = await startTestServer({ ADMIN_TOKEN: 'test-admin-token' });
    const a = await t.signIn('alex');
    const b = await t.signIn('bea');
    const url = ((await upload(b)).body as User).avatarUrl!;
    await t.http().post('/reports').set(a.auth).send({ userId: b.id, reason: 'inappropriate' });

    const [report] = (await t.http().get('/admin/reports').set(ADMIN)).body;
    expect(keyOf(report.target.avatarUrl)).toBe(keyOf(url));

    expect((await t.http().post(`/admin/users/${b.id}/remove-avatar`).set(ADMIN)).status).toBe(204);
    expect(stored(url)).toBe(false);
    expect(((await t.http().get('/me').set(b.auth)).body as User).avatarUrl).toBeNull();
    const [after] = (await t.http().get('/admin/reports').set(ADMIN)).body;
    expect(after.target.avatarUrl).toBeNull();

    expect((await t.http().post(`/admin/users/${b.id}/remove-avatar`)).status).not.toBe(204);
    expect((await t.http().post('/admin/users/00000000-0000-4000-8000-000000000000/remove-avatar').set(ADMIN)).status).toBe(404);
  });
});
