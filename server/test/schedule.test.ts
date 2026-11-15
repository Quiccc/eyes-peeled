import { afterEach, describe, expect, it } from 'vitest';

import type { Daily, Difficulty } from '@shared/types';

import { WORD_POOL } from '../src/seed/words';
import { fakeModelInfo, type ModelInfo } from '../src/services/model-info';
import type { AdminWord, MonthSchedule } from '../src/services/schedule';
import { jpeg, startTestServer, type TestServer } from './helpers';

const ADMIN = { Authorization: 'Bearer test-admin-token' };
const ALL_SEEDED = Object.values(WORD_POOL).flat();

let t: TestServer;
const start = async (model?: ModelInfo) => {
  t = await startTestServer({ ADMIN_TOKEN: 'test-admin-token' }, { model });
  return t;
};
afterEach(() => t.close());

const schedule = async (month = '2026-11') =>
  (await t.http().get(`/admin/schedule?month=${month}`).set(ADMIN)).body as MonthSchedule;
const fill = (month = '2026-11') => t.http().post('/admin/schedule').set(ADMIN).send({ month });
const words = async () => (await t.http().get('/admin/words').set(ADMIN)).body as AdminWord[];
const wordId = async (label: string, difficulty: Difficulty) =>
  (await words()).find((w) => w.label === label && w.difficulty === difficulty)!.id;
const setDay = (date: string, difficulty: Difficulty, id: string) =>
  t.http().put(`/admin/schedule/${date}/${difficulty}`).set(ADMIN).send({ wordId: id });

describe('admin auth', () => {
  it('hides admin routes without the token', async () => {
    await start();
    expect((await t.http().get('/admin/check')).status).toBe(404);
    expect((await t.http().get('/admin/check').set({ Authorization: 'Bearer nope' })).status).toBe(404);
    expect((await t.http().get('/admin/check').set(ADMIN)).status).toBe(204);
  });
});

describe('monthly schedule', () => {
  it('fills empty days from today to the end of the month and keeps planned days', async () => {
    await start();
    const cup = await wordId('cup', 'easy');
    expect((await setDay('2026-11-20', 'easy', cup)).status).toBe(204);

    const res = await fill();
    expect(res.status).toBe(200);
    // 14th..30th = 17 days x 4 difficulties, minus the one planned slot
    expect(res.body.filled).toBe(17 * 4 - 1);

    const month = await schedule();
    expect(month.today).toBe('2026-11-14');
    for (const day of month.days) {
      const planned = Object.values(day.words).filter(Boolean).length;
      expect(planned).toBe(day.date < '2026-11-14' ? 0 : 4);
    }
    expect(month.days.find((d) => d.date === '2026-11-20')!.words.easy!.label).toBe('cup');

    // Filling again changes nothing.
    expect((await fill()).body.filled).toBe(0);
  });

  it('serves the planned words to players', async () => {
    await start();
    const vase = await wordId('vase', 'medium');
    await setDay('2026-11-15', 'medium', vase);
    t.setNow('2026-11-15T08:00:00Z');
    const a = await t.signIn('alex');
    const daily = (await t.http().get('/daily').set(a.auth)).body as Daily;
    expect(daily.words.find((w) => w.difficulty === 'medium')!.word).toBe('vase');
  });

  it('spreads repeats as far apart as the pool allows', async () => {
    await start();
    await fill('2026-11');
    await fill('2026-12');
    const days = [...(await schedule('2026-11')).days, ...(await schedule('2026-12')).days].filter(
      (d) => d.date >= '2026-11-14',
    );
    for (const difficulty of ['easy', 'medium', 'hard', 'expert'] as const) {
      const last = new Map<string, number>();
      days.forEach((d, i) => {
        const label = d.words[difficulty]!.label;
        if (last.has(label)) expect(i - last.get(label)!).toBeGreaterThanOrEqual(WORD_POOL[difficulty].length - 1);
        last.set(label, i);
      });
    }
  });

  it('skips retired words', async () => {
    await start();
    const chair = await wordId('chair', 'easy');
    expect((await t.http().patch(`/admin/words/${chair}`).set(ADMIN).send({ enabled: false })).status).toBe(204);
    await fill();
    const month = await schedule();
    expect(month.days.some((d) => d.words.easy?.label === 'chair')).toBe(false);
    expect((await setDay('2026-11-28', 'easy', chair)).status).toBe(400);
  });

  it("locks today and past days, and a word's difficulty must match", async () => {
    await start();
    const cup = await wordId('cup', 'easy');
    expect((await setDay('2026-11-14', 'easy', cup)).status).toBe(400);
    expect((await setDay('2026-11-01', 'easy', cup)).status).toBe(400);
    expect((await setDay('2026-11-20', 'hard', cup)).status).toBe(400);
    expect((await t.http().get('/admin/schedule?month=2026-13').set(ADMIN)).status).toBe(400);
  });
});

describe('words the model knows', () => {
  const known = [...ALL_SEEDED.filter((w) => w !== 'toaster'), 'person'];

  it('never schedules or adds a word the model does not know', async () => {
    await start(fakeModelInfo(known));
    await fill();
    expect((await schedule()).days.some((d) => d.words.medium?.label === 'toaster')).toBe(false);

    const toaster = await wordId('toaster', 'medium');
    const refused = await setDay('2026-11-25', 'medium', toaster);
    expect(refused.status).toBe(400);
    expect(refused.body.message).toContain('toaster');

    const list = await words();
    expect(list.find((w) => w.label === 'toaster')!.knownByModel).toBe(false);
    expect(list.find((w) => w.label === 'cup')!.knownByModel).toBe(true);

    expect((await t.http().post('/admin/words').set(ADMIN).send({ label: 'unicorn', difficulty: 'hard' })).status).toBe(400);
    expect((await t.http().post('/admin/words').set(ADMIN).send({ label: ' Person ', difficulty: 'hard' })).status).toBe(204);
    expect((await t.http().post('/admin/words').set(ADMIN).send({ label: 'person', difficulty: 'hard' })).status).toBe(409);
    expect((await words()).some((w) => w.label === 'person' && w.difficulty === 'hard')).toBe(true);
  });

  it('answers 503 when the YOLO service is down', async () => {
    const down: ModelInfo = { ...fakeModelInfo([]), classes: () => Promise.reject(new Error('down')) };
    await start(down);
    const res = await fill();
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('model_unavailable');
  });
});

describe('per-word threshold', () => {
  it('uses the word threshold instead of YOLO_MIN_CONFIDENCE', async () => {
    await start();
    const a = await t.signIn('alex');
    const daily = (await t.http().get('/daily').set(a.auth)).body as Daily;
    const [easy, medium] = daily.words;
    t.setVerdict({ detected: true, confidence: 0.6 });

    const easyWord = await wordId(easy!.word, 'easy');
    await t.http().patch(`/admin/words/${easyWord}`).set(ADMIN).send({ minConfidence: 0.7 });

    const strict = await t.http().post(`/words/${easy!.id}/submissions`).set(a.auth).attach('photo', jpeg(), 'p.jpg');
    expect(strict.body.status).toBe('invalid');
    const normal = await t.http().post(`/words/${medium!.id}/submissions`).set(a.auth).attach('photo', jpeg(), 'p.jpg');
    expect(normal.body.status).toBe('valid');

    // Back to the default
    await t.http().patch(`/admin/words/${easyWord}`).set(ADMIN).send({ minConfidence: null });
    const again = await t.http().post(`/words/${easy!.id}/submissions`).set(a.auth).attach('photo', jpeg(), 'p.jpg');
    expect(again.body.status).toBe('valid');
  });
});
