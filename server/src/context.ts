import type { Db } from './db/client';
import type { Env } from './env';
import type { Clock } from './lib/clock';
import type { ModelInfo } from './services/model-info';
import type { VerificationQueue } from './services/queue';
import type { Storage } from './services/storage';
import type { Verifier } from './services/verifier';

/** Everything route handlers and services need. Built once in index.ts (or per test). */
export type Ctx = {
  db: Db;
  env: Env;
  clock: Clock;
  storage: Storage;
  verifier: Verifier;
  /** What the YOLO model knows (labels, version, word-test report). */
  model: ModelInfo;
  queue: VerificationQueue;
};
