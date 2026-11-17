import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import request from 'supertest';

import type { AuthResponse } from '@shared/types';

import { createApp } from '../src/app';
import type { Ctx } from '../src/context';
import { openDatabase } from '../src/db/client';
import { loadEnv } from '../src/env';
import { seedWords } from '../src/seed/words';
import { noModelInfo, type ModelInfo } from '../src/services/model-info';
import { createQueue } from '../src/services/queue';
import { localStorage } from '../src/services/storage';
import { stubVerifier, type Verdict } from '../src/services/verifier';

/** A tiny valid-looking JPEG (magic bytes + random payload so each one hashes differently). */
export function jpeg(seed = Math.random().toString()): Buffer {
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(seed), Buffer.from([0xff, 0xd9])]);
}

export type TestServer = Awaited<ReturnType<typeof startTestServer>>;

export async function startTestServer(envOverrides: Record<string, string> = {}, opts: { model?: ModelInfo } = {}) {
  const env = loadEnv({
    NODE_ENV: 'test',
    JWT_SECRET: 'test-jwt-secret-test-jwt-secret-1234',
    FILE_URL_SECRET: 'test-file-secret-test-file-secret-1234',
    AUTH_DEV_LOGIN: 'true',
    PUBLIC_BASE_URL: 'http://test.local',
    // Tests move the clock across days; keep tokens valid unless a test is about expiry.
    ACCESS_TOKEN_TTL_SEC: String(30 * 86_400),
    ...envOverrides,
  });
  const database = await openDatabase({ dataDir: null });
  await seedWords(database.db);
  const dir = mkdtempSync(path.join(tmpdir(), 'wordhunt-'));

  let now = new Date('2026-11-14T06:00:00Z');
  const clock = { now: () => new Date(now) };
  let decide: (label: string) => Verdict | Promise<Verdict> = () => ({ detected: true, confidence: 0.9 });

  const ctx: Ctx = {
    db: database.db,
    env,
    clock,
    storage: localStorage({ dir, baseUrl: env.PUBLIC_BASE_URL, secret: env.FILE_URL_SECRET, now: clock.now }),
    verifier: stubVerifier((label) => decide(label)),
    model: opts.model ?? noModelInfo(),
    queue: createQueue(2),
  };
  const app = createApp(ctx, { rateLimit: false });

  return {
    ctx,
    app,
    /** Where the test's photos are stored. */
    storageDir: dir,
    http: () => request(app),
    setNow(iso: string) {
      now = new Date(iso);
    },
    setVerdict(v: Verdict | ((label: string) => Verdict | Promise<Verdict>)) {
      decide = typeof v === 'function' ? v : () => v;
    },
    /** Sign in with dev login and (optionally) pick a username. Returns the token and user. */
    async signIn(name: string, opts: { username?: string | false } = {}) {
      const res = await request(app).post('/auth/signin').send({ provider: 'google', idToken: `dev:${name}` });
      if (res.status !== 200) throw new Error(`sign-in failed: ${res.status} ${JSON.stringify(res.body)}`);
      const body = res.body as AuthResponse;
      const auth = { Authorization: `Bearer ${body.accessToken}` };
      if (opts.username !== false) {
        await request(app)
          .patch('/me')
          .set(auth)
          .send({ username: opts.username ?? name });
      }
      return { ...body, auth, id: body.user.id };
    },
    async close() {
      await ctx.queue.idle();
      await database.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
