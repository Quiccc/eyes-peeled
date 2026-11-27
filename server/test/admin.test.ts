import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app';

import type { Daily, FriendsList } from '@shared/types';

import type { AdminWord, WordDayStats } from '../src/dto/admin';
import { jpeg, startTestServer, type TestServer } from './helpers';

const ADMIN = { Authorization: 'Bearer test-admin-token' };

let t: TestServer;
const start = async () => {
  t = await startTestServer({ ADMIN_TOKEN: 'test-admin-token' });
  return t;
};
afterEach(() => t.close());

describe('admin panel files', () => {
  it('serves the built panel, including deep links, from a path with a dot-folder', async () => {
    await start();
    const dir = mkdtempSync(path.join(tmpdir(), 'panel-'));
    const panel = path.join(dir, '.hidden', 'dist');
    mkdirSync(path.join(panel, 'assets'), { recursive: true });
    writeFileSync(path.join(panel, 'index.html'), '<title>Panel</title>');
    writeFileSync(path.join(panel, 'assets', 'app.js'), 'console.log(1)');
    const app = createApp(t.ctx, { rateLimit: false, adminPanelDir: panel });
    try {
      expect((await request(app).get('/admin-panel/')).text).toContain('Panel');
      expect((await request(app).get('/admin-panel/words')).text).toContain('Panel');
      expect((await request(app).get('/admin-panel/assets/app.js')).status).toBe(200);
      // The API under /admin/* is untouched.
      expect((await request(app).get('/admin/check')).status).toBe(404);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('admin rate limit', () => {
  it('slows down token guessing but not real use', async () => {
    await start();
    const guess = request(createApp(t.ctx));
    for (let i = 0; i < 10; i++) {
      expect((await guess.get('/admin/check').set({ Authorization: `Bearer wrong-${i}` })).status).toBe(404);
    }
    expect((await guess.get('/admin/check').set({ Authorization: 'Bearer wrong' })).status).toBe(429);

    const admin = request(createApp(t.ctx));
    for (let i = 0; i < 15; i++) {
      expect((await admin.get('/admin/check').set(ADMIN)).status).toBe(204);
    }
  });
});

describe('GET /admin/stats', () => {
  it('counts attempts, finds and finders per daily word', async () => {
    await start();
    const a = await t.signIn('alex');
    const b = await t.signIn('bob');
    const [easy, medium] = ((await t.http().get('/daily').set(a.auth)).body as Daily).words;
    const submit = (auth: Record<string, string>, id: string) =>
      t.http().post(`/words/${id}/submissions`).set(auth).attach('photo', jpeg(), 'p.jpg');

    t.setVerdict({ detected: false, confidence: 0.3 });
    await submit(a.auth, easy!.id);
    await submit(b.auth, easy!.id);
    t.setVerdict({ detected: true, confidence: 0.9 });
    await submit(a.auth, easy!.id);
    await submit(b.auth, medium!.id);

    const res = await t.http().get('/admin/stats?from=2026-11-14&to=2026-11-14').set(ADMIN);
    expect(res.status).toBe(200);
    const rows = res.body as WordDayStats[];
    expect(rows.map((r) => r.difficulty)).toEqual(['easy', 'medium', 'hard', 'expert']);
    expect(rows[0]).toMatchObject({ label: easy!.word, attempts: 3, valid: 1, invalid: 2, finders: 1, passRate: 0.333 });
    expect(rows[0]!.avgInvalidConfidence).toBeCloseTo(0.3);
    expect(rows[1]).toMatchObject({ attempts: 1, valid: 1, passRate: 1 });
    expect(rows[2]).toMatchObject({ attempts: 0, passRate: null });

    expect((await t.http().get('/admin/stats?from=2026-11-15&to=2026-11-01').set(ADMIN)).status).toBe(400);
  });
});

describe('reports', () => {
  it('resolves a report and moves it to the resolved list', async () => {
    await start();
    const a = await t.signIn('alex');
    const b = await t.signIn('bob');
    await t.http().post('/reports').set(a.auth).send({ userId: b.id, reason: 'spam' });

    const [report] = (await t.http().get('/admin/reports').set(ADMIN)).body;
    expect(report).toMatchObject({ reason: 'spam', submission: null, target: { id: b.id } });
    expect((await t.http().post(`/admin/reports/${report.id}/resolve`).set(ADMIN)).status).toBe(204);

    expect((await t.http().get('/admin/reports').set(ADMIN)).body).toEqual([]);
    expect((await t.http().get('/admin/reports?status=resolved').set(ADMIN)).body).toHaveLength(1);
  });

  it('accepts a report about an unknown user quietly', async () => {
    await start();
    const a = await t.signIn('alex');
    const res = await t.http().post('/reports').set(a.auth).send({ userId: crypto.randomUUID(), reason: 'spam' });
    expect(res.status).toBe(204);
    expect((await t.http().get('/admin/reports').set(ADMIN)).body).toEqual([]);
  });
});

describe('moderation', () => {
  it('lists the reported user, and ban/unban works', async () => {
    await start();
    const a = await t.signIn('alex');
    const b = await t.signIn('bob');
    const easy = ((await t.http().get('/daily').set(b.auth)).body as Daily).words[0]!;
    const photo = await t.http().post(`/words/${easy.id}/submissions`).set(b.auth).attach('photo', jpeg(), 'p.jpg');
    await t.http().post('/reports').set(a.auth).send({ submissionId: photo.body.id, reason: 'cheating' });

    const [report] = (await t.http().get('/admin/reports').set(ADMIN)).body;
    expect(report.target).toMatchObject({ id: b.id, username: 'bob', bannedAt: null });

    expect((await t.http().post(`/admin/users/${b.id}/ban`).set(ADMIN)).status).toBe(204);
    expect((await t.http().get('/me').set(b.auth)).status).toBe(403);
    expect((await t.http().get('/admin/reports').set(ADMIN)).body[0].target.bannedAt).not.toBeNull();

    expect((await t.http().post(`/admin/users/${b.id}/unban`).set(ADMIN)).status).toBe(204);
    expect((await t.http().get('/me').set(b.auth)).status).toBe(200);
  });

  it('banned players drop out of friends lists and come back when unbanned', async () => {
    await start();
    const a = await t.signIn('alex');
    const b = await t.signIn('bob');
    const c = await t.signIn('cara');
    await t.http().post('/friends/requests').set(a.auth).send({ userId: b.id });
    await t.http().post('/friends/requests').set(b.auth).send({ userId: a.id });
    await t.http().post('/friends/requests').set(a.auth).send({ userId: c.id });
    const names = async () => {
      const l = (await t.http().get('/friends').set(a.auth)).body as FriendsList;
      return { friends: l.friends.map((f) => f.user.username), sent: l.sent.map((s) => s.to.username) };
    };
    expect(await names()).toEqual({ friends: ['bob'], sent: ['cara'] });

    await t.http().post(`/admin/users/${b.id}/ban`).set(ADMIN);
    await t.http().post(`/admin/users/${c.id}/ban`).set(ADMIN);
    expect(await names()).toEqual({ friends: [], sent: [] });

    await t.http().post(`/admin/users/${b.id}/unban`).set(ADMIN);
    expect(await names()).toEqual({ friends: ['bob'], sent: [] });
  });
});

describe('word translations', () => {
  const words = async () => (await t.http().get('/admin/words').set(ADMIN)).body as AdminWord[];

  it('saves hand-edited translations, dropping empty and unknown languages', async () => {
    await start();
    const chair = (await words()).find((w) => w.label === 'chair')!;
    expect(chair.translations.es).toBe('silla');
    const res = await t
      .http()
      .patch(`/admin/words/${chair.id}`)
      .set(ADMIN)
      .send({ translations: { es: ' silla de oficina ', fr: '', xx: 'nope' } });
    expect(res.status).toBe(204);
    expect((await words()).find((w) => w.id === chair.id)!.translations).toEqual({ es: 'silla de oficina' });
  });

  it('auto-translates new words and fills only missing languages', async () => {
    await start();
    expect((await t.http().post('/admin/words/translate').set(ADMIN).send({})).status).toBe(503);

    const asked: string[] = [];
    t.setTranslator({
      async translate(label) {
        asked.push(label);
        if (label === 'broken') throw new Error('down');
        return { es: `${label}-es`, de: `${label}-de` };
      },
    });
    await t.http().post('/admin/words').set(ADMIN).send({ label: 'Lamp', difficulty: 'easy' });
    expect((await words()).find((w) => w.label === 'lamp')!.translations).toEqual({ es: 'lamp-es', de: 'lamp-de' });

    await t.http().post('/admin/words').set(ADMIN).send({ label: 'broken', difficulty: 'easy' });
    const lamp = (await words()).find((w) => w.label === 'lamp')!;
    await t.http().patch(`/admin/words/${lamp.id}`).set(ADMIN).send({ translations: { es: 'lámpara' } });
    asked.length = 0;
    const broken = (await words()).find((w) => w.label === 'broken')!;
    const res = await t.http().post('/admin/words/translate').set(ADMIN).send({ ids: [lamp.id, broken.id] });
    expect(res.body).toEqual({ translated: 1, failed: ['broken'] });
    // Hand edits win over Claude's suggestions.
    expect((await words()).find((w) => w.id === lamp.id)!.translations).toEqual({ es: 'lámpara', de: 'lamp-de' });
  });
});
