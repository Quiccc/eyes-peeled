import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Daily } from '@shared/types';

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

  it('marks the photo invalid when the verifier is down', async () => {
    const a = await t.signIn('alex');
    t.setVerdict(() => {
      throw new Error('YOLO down');
    });
    const res = await submit(a.auth, (await daily(a.auth)).words[0]!.id);
    expect(res.body.status).toBe('invalid');
    expect(res.body.message).toMatch(/couldn't check/);
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
