import { afterEach, describe, expect, it } from 'vitest';

import type { Daily, Difficulty } from '@shared/types';

import { WORD_POOL } from '../src/seed/words';
import type { AdminWord, MonthSchedule } from '../src/dto/admin';
import { jpeg, startTestServer, type TestServer } from './helpers';

const ADMIN = { Authorization: 'Bearer test-admin-token' };

let t: TestServer;
const start = async () => {
  t = await startTestServer({ ADMIN_TOKEN: 'test-admin-token' });
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

describe('adding words', () => {
  it('accepts any new word, stored trimmed and lower case, and schedules it', async () => {
    await start();
    const add = (label: string) => t.http().post('/admin/words').set(ADMIN).send({ label, difficulty: 'hard' });
    expect((await add(' Unicorn Mug ')).status).toBe(204);
    expect((await add('unicorn mug')).status).toBe(409);

    const mug = await wordId('unicorn mug', 'hard');
    expect((await setDay('2026-11-25', 'hard', mug)).status).toBe(204);
    expect((await schedule()).days.find((d) => d.date === '2026-11-25')!.words.hard?.label).toBe('unicorn mug');
  });
});

describe('per-word threshold', () => {
  it('uses the word threshold instead of VERIFY_MIN_CONFIDENCE', async () => {
    await start();
    const a = await t.signIn('alex');
    const daily = (await t.http().get('/daily').set(a.auth)).body as Daily;
    const [easy, medium] = daily.words;
    t.setVerdict({ detected: true, confidence: 0.8 });

    const easyWord = await wordId(easy!.word, 'easy');
    await t.http().patch(`/admin/words/${easyWord}`).set(ADMIN).send({ minConfidence: 0.9 });

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
