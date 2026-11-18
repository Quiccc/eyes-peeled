import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createApp } from './app';
import type { Ctx } from './context';
import { openDatabase } from './db/client';
import { loadEnv } from './env';
import { systemClock } from './lib/clock';
import { logger } from './lib/logger';
import { seedWords } from './seed/words';
import { createQueue } from './services/queue';
import { autoSchedule } from './services/schedule';
import { localStorage } from './services/storage';
import { requeuePending } from './services/verification';
import { verifierFor } from './services/verifier';

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
  verifier: verifierFor(env),
  queue: createQueue(2),
};

const requeued = await requeuePending(ctx);

const server = createApp(ctx, { adminPanelDir }).listen(env.PORT, '0.0.0.0', () => {
  logger.info(
    {
      port: env.PORT,
      database: env.DATABASE_URL ? 'postgres' : `pglite (${path.join(dataDir, 'db')})`,
      verifier: env.ANTHROPIC_API_KEY ? `claude (${env.VERIFY_MODEL})` : 'stub (random ~60% pass; set ANTHROPIC_API_KEY)',
      devLogin: env.AUTH_DEV_LOGIN,
      adminPanel: env.ADMIN_TOKEN ? `${env.PUBLIC_BASE_URL}/admin-panel/` : 'off',
      requeuedPhotos: requeued,
    },
    `Eyes Peeled API on http://localhost:${env.PORT}`,
  );
});

let autoTimer: NodeJS.Timeout | undefined;
if (env.AUTO_SCHEDULE) {
  const run = () =>
    autoSchedule(ctx)
      .then((n) => n && logger.info({ slots: n }, 'auto-schedule planned next month'))
      .catch((err: unknown) => logger.error({ err }, 'auto-schedule failed'));
  void run();
  autoTimer = setInterval(run, 6 * 60 * 60 * 1000);
  autoTimer.unref();
}

let stopping = false;
const shutdown = (signal: string) => {
  if (stopping) return;
  stopping = true;
  logger.info({ signal }, 'shutting down');
  clearInterval(autoTimer);
  // Don't let a stuck connection or photo check hold `docker stop` until it SIGKILLs us;
  // pending photos are re-checked on the next start anyway.
  setTimeout(() => {
    logger.warn('shutdown timed out, exiting');
    process.exit(1);
  }, 10_000).unref();
  server.close(async () => {
    await ctx.queue.idle();
    await database.close();
    process.exit(0);
  });
  server.closeIdleConnections();
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
