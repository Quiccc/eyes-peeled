import path from 'node:path';

import { createApp } from './app';
import type { Ctx } from './context';
import { openDatabase } from './db/client';
import { loadEnv } from './env';
import { systemClock } from './lib/clock';
import { seedWords } from './seed/words';
import { createQueue } from './services/queue';
import { localStorage } from './services/storage';
import { requeuePending } from './services/submissions';
import { httpYoloVerifier, stubVerifier } from './services/verifier';

const env = loadEnv();
const database = await openDatabase({ databaseUrl: env.DATABASE_URL, dataDir: env.DATA_DIR });
await seedWords(database.db);

const ctx: Ctx = {
  db: database.db,
  env,
  clock: systemClock,
  storage: localStorage({
    dir: path.join(env.DATA_DIR, 'uploads'),
    baseUrl: env.PUBLIC_BASE_URL,
    secret: env.FILE_URL_SECRET,
    now: () => systemClock.now(),
  }),
  verifier: env.YOLO_URL ? httpYoloVerifier({ url: env.YOLO_URL, key: env.YOLO_KEY }) : stubVerifier(),
  queue: createQueue(2),
};

const requeued = await requeuePending(ctx);

const server = createApp(ctx, { log: true }).listen(env.PORT, '0.0.0.0', () => {
  console.log(`Word Hunt API on http://localhost:${env.PORT}`);
  console.log(`  database: ${env.DATABASE_URL ? 'Postgres (DATABASE_URL)' : `PGlite in ${path.resolve(env.DATA_DIR, 'db')}`}`);
  console.log(`  verifier: ${env.YOLO_URL ? `YOLO at ${env.YOLO_URL}` : 'stub (random ~60% pass). Set YOLO_URL for real checks.'}`);
  if (env.AUTH_DEV_LOGIN) console.log('  dev login: ON (idToken "dev:<name>")');
  if (requeued) console.log(`  re-checking ${requeued} pending photo(s)`);
});

const shutdown = () => {
  server.close(async () => {
    await ctx.queue.idle();
    await database.close();
    process.exit(0);
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
