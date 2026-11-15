import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createApp } from './app';
import type { Ctx } from './context';
import { openDatabase } from './db/client';
import { loadEnv } from './env';
import { systemClock } from './lib/clock';
import { seedWords } from './seed/words';
import { wordsUnknownToModel } from './services/model-labels';
import { createQueue } from './services/queue';
import { autoSchedule } from './services/schedule';
import { localStorage } from './services/storage';
import { requeuePending } from './services/verification';
import { yoloClients } from './services/yolo-client';

const env = loadEnv();
// Relative folders in .env are relative to server/, wherever the process was started from.
const SERVER_ROOT = fileURLToPath(new URL('..', import.meta.url));
const dataDir = path.resolve(SERVER_ROOT, env.DATA_DIR);
const adminPanelDir = path.resolve(SERVER_ROOT, env.ADMIN_PANEL_DIR);

const database = await openDatabase({ databaseUrl: env.DATABASE_URL, dataDir });
await seedWords(database.db);

const ctx: Ctx = {
  db: database.db,
  env,
  clock: systemClock,
  storage: localStorage({
    dir: path.join(dataDir, 'uploads'),
    baseUrl: env.PUBLIC_BASE_URL,
    secret: env.FILE_URL_SECRET,
    now: () => systemClock.now(),
  }),
  ...yoloClients(env),
  queue: createQueue(2),
};

const requeued = await requeuePending(ctx);

const server = createApp(ctx, { log: true, adminPanelDir }).listen(env.PORT, '0.0.0.0', () => {
  console.log(`Word Hunt API on http://localhost:${env.PORT}`);
  console.log(`  database: ${env.DATABASE_URL ? 'Postgres (DATABASE_URL)' : `PGlite in ${path.join(dataDir, 'db')}`}`);
  console.log(`  verifier: ${env.YOLO_URL ? `YOLO at ${env.YOLO_URL}` : 'stub (random ~60% pass). Set YOLO_URL for real checks.'}`);
  if (env.AUTH_DEV_LOGIN) console.log('  dev login: ON (idToken "dev:<name>")');
  if (env.ADMIN_TOKEN) console.log(`  admin panel: http://localhost:${env.PORT}/admin-panel/ (after building server/admin/)`);
  if (requeued) console.log(`  re-checking ${requeued} pending photo(s)`);
});

// Words the model can't judge would fail every player. Warn early; scheduling refuses them anyway.
wordsUnknownToModel(ctx)
  .then((unknown) => {
    if (unknown.length) console.warn(`  WARNING: the YOLO model doesn't know these enabled words: ${unknown.join(', ')}`);
  })
  .catch((e: unknown) => console.warn(`  WARNING: couldn't ask the YOLO service which words it knows (${String(e)})`));

let autoTimer: NodeJS.Timeout | undefined;
if (env.AUTO_SCHEDULE) {
  const run = () =>
    autoSchedule(ctx)
      .then((n) => n && console.log(`  auto-schedule: planned ${n} word slot(s) for next month`))
      .catch((e: unknown) => console.error('auto-schedule failed', e));
  void run();
  autoTimer = setInterval(run, 6 * 60 * 60 * 1000);
  autoTimer.unref();
}

const shutdown = () => {
  clearInterval(autoTimer);
  server.close(async () => {
    await ctx.queue.idle();
    await database.close();
    process.exit(0);
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
