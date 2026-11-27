import type { Db } from './db/client';
import type { Env } from './env';
import type { Clock } from './lib/clock';
import type { VerificationQueue } from './services/queue';
import type { Storage } from './services/storage';
import type { Verifier } from './services/verifier';
import type { WordTranslator } from './services/word-translator';

/** Everything route handlers and services need. Built once in index.ts (or per test). */
export type Ctx = {
  db: Db;
  env: Env;
  clock: Clock;
  storage: Storage;
  verifier: Verifier;
  queue: VerificationQueue;
  /** Null without ANTHROPIC_API_KEY: words are then translated by hand in the admin panel. */
  translator: WordTranslator | null;
};
