import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app';

import type { Daily } from '@shared/types';

import { fakeModelInfo, type ModelInfo } from '../src/services/model-info';
import type { WordDayStats } from '../src/services/admin-stats';
import { jpeg, startTestServer, type TestServer } from './helpers';

const ADMIN = { Authorization: 'Bearer test-admin-token' };

let t: TestServer;
const start = async (model?: ModelInfo) => {
  t = await startTestServer({ ADMIN_TOKEN: 'test-admin-token' }, { model });
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

describe('GET /admin/model', () => {
  it('reports no YOLO service when none is configured', async () => {
    await start();
    const res = await t.http().get('/admin/model').set(ADMIN);
    expect(res.body).toMatchObject({ configured: false, health: null, unknownWords: [], threshold: 0.5 });
  });

  it('shows health, the word-test report and enabled words the model lacks', async () => {
    const report = { modelVersion: 'fake', words: [{ word: 'cup', pass: true }] };
    await start(fakeModelInfo(['cup', 'chair'], { report }));
    const res = await t.http().get('/admin/model').set(ADMIN);
    expect(res.body.configured).toBe(true);
    expect(res.body.health).toMatchObject({ ok: true, modelVersion: 'fake' });
    expect(res.body.report).toEqual(report);
    expect(res.body.unknownWords).toContain('bicycle');
    expect(res.body.unknownWords).not.toContain('cup');
  });

  it('shows the error when the service is down', async () => {
    await start({ ...fakeModelInfo([]), health: () => Promise.reject(new Error('connect ECONNREFUSED')) });
    const res = await t.http().get('/admin/model').set(ADMIN);
    expect(res.status).toBe(200);
    expect(res.body.error).toContain('ECONNREFUSED');
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
});
