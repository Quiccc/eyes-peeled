import { readdirSync } from 'node:fs';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Daily, Leaderboard } from '@shared/types';

import { removeSubmission } from '../src/services/moderation';
import { jpeg, startTestServer, type TestServer } from './helpers';

let t: TestServer;
beforeEach(async () => {
  t = await startTestServer();
});
afterEach(() => t.close());

type Auth = Record<string, string>;
const daily = async (auth: Auth) => (await t.http().get('/daily').set(auth)).body as Daily;
const submit = (auth: Auth, wordId: string, photo = jpeg()) =>
  t.http().post(`/words/${wordId}/submissions`).set(auth).attach('photo', photo, 'photo.jpg');

describe('daily words', () => {
  it('gives free users 3 words and Premium users 4, the same for everyone', async () => {
    const a = await t.signIn('alex');
    const b = await t.signIn('bob');
    const da = await daily(a.auth);
    expect(da.date).toBe('2026-11-14');
    expect(da.nextResetAt).toBe('2026-11-15T00:00:00.000Z');
    expect(da.words.map((w) => w.difficulty)).toEqual(['easy', 'medium', 'hard']);
    expect(da.words.every((w) => w.status === 'open' && w.foundCount === 0 && w.firstFoundAt === null)).toBe(true);

    const synced = await t.http().post('/me/purchases/sync').set(b.auth);
    expect(synced.body.isPremium).toBe(true);
    const db = await daily(b.auth);
    expect(db.words.map((w) => w.difficulty)).toEqual(['easy', 'medium', 'hard', 'expert']);
    expect(db.words.slice(0, 3)).toEqual(da.words);
  });

  it('rolls over at 00:00 UTC', async () => {
    const a = await t.signIn('alex');
    const today = await daily(a.auth);
    t.setNow('2026-11-15T00:00:01Z');
    const tomorrow = await daily(a.auth);
    expect(tomorrow.date).toBe('2026-11-15');
    expect(tomorrow.words.map((w) => w.id)).not.toEqual(today.words.map((w) => w.id));
    // Yesterday's word can't be submitted any more.
    const late = await submit(a.auth, today.words[0]!.id);
    expect(late.status).toBe(404);
    expect(late.body.code).toBe('word_not_found');
  });
});

describe('submissions', () => {
  it('scores a valid find by receipt time and rank', async () => {
    const a = await t.signIn('alex');
    const b = await t.signIn('bob');
    const easy = (await daily(a.auth)).words[0]!;

    const first = await submit(a.auth, easy.id);
    expect(first.status).toBe(200);
    // 06:00 UTC = a quarter of the day gone: 100 * 0.75
    expect(first.body).toMatchObject({ status: 'valid', points: 75, rank: 1, wordId: easy.id });
    expect(first.body.imageUrl).toMatch(/^http:\/\/test\.local\/files\/.+\?exp=\d+&sig=/);
    // The first valid photo's receipt time; later finds don't move it.
    const firstFoundAt = (await daily(b.auth)).words[0]!.firstFoundAt;
    expect(firstFoundAt).toBe('2026-11-14T06:00:00.000Z');

    t.setNow('2026-11-14T23:00:00Z');
    const second = await submit(b.auth, easy.id);
    expect(second.body).toMatchObject({ status: 'valid', points: 20, rank: 2 }); // floor at 20%

    const after = (await daily(a.auth)).words[0]!;
    expect(after).toMatchObject({ status: 'found', foundCount: 2, firstFoundAt });
    expect(after.submission?.id).toBe(first.body.id);

    const again = await submit(a.auth, easy.id);
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('already_found');
  });

  it('lets players retry after an invalid photo, up to the attempt limit', async () => {
    const a = await t.signIn('alex');
    const word = (await daily(a.auth)).words[1]!;
    t.setVerdict({ detected: false, confidence: 0.2 });

    const miss = await submit(a.auth, word.id);
    expect(miss.body).toMatchObject({ status: 'invalid', points: 0, rank: null });
    expect(miss.body.message).toContain(word.word);
    expect((await daily(a.auth)).words[1]!.status).toBe('open');

    for (let i = 1; i < 10; i++) expect((await submit(a.auth, word.id)).status).toBe(200);
    const limited = await submit(a.auth, word.id);
    expect(limited.status).toBe(429);
    expect(limited.body.code).toBe('rate_limited');
  });

  it('treats low-confidence detections as invalid', async () => {
    const a = await t.signIn('alex');
    t.setVerdict({ detected: true, confidence: 0.3 });
    const res = await submit(a.auth, (await daily(a.auth)).words[0]!.id);
    expect(res.body.status).toBe('invalid');
  });

  it('rejects exact re-uploads of a photo', async () => {
    const a = await t.signIn('alex');
    const b = await t.signIn('bob');
    const word = (await daily(a.auth)).words[0]!;
    const photo = jpeg('same');
    expect((await submit(a.auth, word.id, photo)).body.status).toBe('valid');
    const copy = await submit(b.auth, word.id, photo);
    expect(copy.body.status).toBe('invalid');
    expect(copy.body.message).toMatch(/seen this exact photo/);
    // The copy is never written to storage.
    expect(copy.body.imageUrl).toBeNull();
    expect(readdirSync(t.storageDir, { recursive: true }).filter((f) => String(f).endsWith('.jpg'))).toHaveLength(1);
  });

  it('keeps the Premium word for Premium players', async () => {
    const a = await t.signIn('alex');
    await t.http().post('/me/purchases/sync').set(a.auth);
    const expert = (await daily(a.auth)).words[3]!;
    const b = await t.signIn('bob');
    const res = await submit(b.auth, expert.id);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('premium_required');
  });

  it('answers pending for slow checks and resumes from /daily', async () => {
    const slow = await startTestServer({ VERIFY_SYNC_WAIT_MS: '20' });
    try {
      let release!: () => void;
      const gate = new Promise<void>((r) => (release = r));
      slow.setVerdict(async () => {
        await gate;
        return { detected: true, confidence: 0.9 };
      });
      const a = await slow.signIn('alex');
      const word = ((await slow.http().get('/daily').set(a.auth)).body as Daily).words[0]!;

      const res = await slow.http().post(`/words/${word.id}/submissions`).set(a.auth).attach('photo', jpeg(), 'p.jpg');
      expect(res.body.status).toBe('pending');

      const mid = ((await slow.http().get('/daily').set(a.auth)).body as Daily).words[0]!;
      expect(mid.status).toBe('pending');
      expect(mid.submission?.id).toBe(res.body.id);

      const blocked = await slow.http().post(`/words/${word.id}/submissions`).set(a.auth).attach('photo', jpeg(), 'p.jpg');
      expect(blocked.status).toBe(409);
      expect(blocked.body.code).toBe('submission_pending');

      release();
      await slow.ctx.queue.idle();
      const done = await slow.http().get(`/submissions/${res.body.id}`).set(a.auth);
      expect(done.body).toMatchObject({ status: 'valid', rank: 1 });
    } finally {
      await slow.close();
    }
  });

  it("answers invalid when the verifier is down, without using up a try", async () => {
    const a = await t.signIn('alex');
    const word = (await daily(a.auth)).words[0]!;
    t.setVerdict(() => {
      throw new Error('YOLO down');
    });
    const photo = jpeg('outage');
    const res = await submit(a.auth, word.id, photo);
    expect(res.body.status).toBe('invalid');
    expect(res.body.message).toMatch(/couldn't check/);

    // More outages than the attempt limit still leave every try.
    for (let i = 0; i < 10; i++) expect((await submit(a.auth, word.id)).body.status).toBe('invalid');

    // Once the verifier is back, the same photo counts.
    t.setVerdict({ detected: true, confidence: 0.9 });
    const retry = await submit(a.auth, word.id, photo);
    expect(retry.status).toBe(200);
    expect(retry.body.status).toBe('valid');
  });

  it('rejects non-JPEG uploads and missing files', async () => {
    const a = await t.signIn('alex');
    const id = (await daily(a.auth)).words[0]!.id;
    const png = await t.http().post(`/words/${id}/submissions`).set(a.auth).attach('photo', Buffer.from('PNGxxxx'), 'x.png');
    expect(png.status).toBe(400);
    const none = await t.http().post(`/words/${id}/submissions`).set(a.auth);
    expect(none.status).toBe(400);
  });

  it("hides other players' submissions", async () => {
    const a = await t.signIn('alex');
    const b = await t.signIn('bob');
    const res = await submit(a.auth, (await daily(a.auth)).words[0]!.id);
    expect((await t.http().get(`/submissions/${res.body.id}`).set(b.auth)).status).toBe(404);
  });
});

describe('combos', () => {
  const combos = async (auth: Auth) => (await daily(auth)).words.map((w) => w.submission?.comboPoints ?? 0);
  const myPoints = async (auth: Auth) =>
    ((await t.http().get('/leaderboard').query({ scope: 'global' }).set(auth)).body as Leaderboard).me?.points;

  it('pays an escalating bonus for adjacent finds, in any order', async () => {
    const a = await t.signIn('alex');
    const [easy, medium, hard] = (await daily(a.auth)).words;

    const h = await submit(a.auth, hard!.id);
    expect(h.body).toMatchObject({ points: 375, comboPoints: 0 });
    // medium links to hard: the day's 1st link
    expect((await submit(a.auth, medium!.id)).body).toMatchObject({ points: 188, comboPoints: 50 });
    // easy links to medium: the 2nd link
    expect((await submit(a.auth, easy!.id)).body).toMatchObject({ points: 75, comboPoints: 100 });

    expect(await combos(a.auth)).toEqual([100, 50, 0]);
    expect(await myPoints(a.auth)).toBe(75 + 188 + 375 + 150);
  });

  it('needs the nodes to be next to each other', async () => {
    const a = await t.signIn('alex');
    const [easy, , hard] = (await daily(a.auth)).words;
    await submit(a.auth, easy!.id);
    await submit(a.auth, hard!.id);
    expect(await combos(a.auth)).toEqual([0, 0, 0]);
  });

  it('pays up to 350 for a full Premium trail', async () => {
    const a = await t.signIn('alex');
    await t.http().post('/me/purchases/sync').set(a.auth);
    for (const w of (await daily(a.auth)).words) await submit(a.auth, w.id);
    expect(await combos(a.auth)).toEqual([0, 50, 100, 200]);
  });

  it('credits a link once when verdicts finish out of order', async () => {
    const slow = await startTestServer({ VERIFY_SYNC_WAIT_MS: '20' });
    try {
      const gates = new Map<string, () => void>();
      slow.setVerdict(async (label) => {
        await new Promise<void>((r) => gates.set(label, r));
        return { detected: true, confidence: 0.9 };
      });
      const a = await slow.signIn('alex');
      const get = async () => ((await slow.http().get('/daily').set(a.auth)).body as Daily).words;
      const [easy, medium] = await get();
      for (const w of [easy!, medium!]) {
        const res = await slow.http().post(`/words/${w.id}/submissions`).set(a.auth).attach('photo', jpeg(w.id), 'p.jpg');
        expect(res.body.status).toBe('pending');
      }
      // medium is decided first, so easy completes the link
      gates.get(medium!.word)!();
      await new Promise((r) => setTimeout(r, 20));
      gates.get(easy!.word)!();
      await slow.ctx.queue.idle();
      expect((await get()).map((w) => w.submission?.comboPoints)).toEqual([50, 0, undefined]);
    } finally {
      await slow.close();
    }
  });

  it('takes the combo back when a linked photo is removed', async () => {
    const a = await t.signIn('alex');
    const [easy, medium, hard] = (await daily(a.auth)).words;
    await submit(a.auth, easy!.id);
    const mid = await submit(a.auth, medium!.id);
    await submit(a.auth, hard!.id);
    expect(await combos(a.auth)).toEqual([0, 50, 100]);

    await removeSubmission(t.ctx, mid.body.id);
    expect(await combos(a.auth)).toEqual([0, 0, 0]);
    expect(await myPoints(a.auth)).toBe(75 + 375);
  });
});

describe('photo URLs', () => {
  it('serve with a valid signature and expire after an hour', async () => {
    const a = await t.signIn('alex');
    const photo = jpeg('look at me');
    const res = await submit(a.auth, (await daily(a.auth)).words[0]!.id, photo);
    const url = new URL(res.body.imageUrl);
    const path = url.pathname + url.search;

    const ok = await t.http().get(path);
    expect(ok.status).toBe(200);
    expect(Buffer.from(ok.body).equals(photo)).toBe(true);

    expect((await t.http().get(path.replace(/sig=[^&]+/, 'sig=forged'))).status).toBe(403);
    t.setNow('2026-11-14T07:01:00Z');
    expect((await t.http().get(path)).status).toBe(403);
  });
});
