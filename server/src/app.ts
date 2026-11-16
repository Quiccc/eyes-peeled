import { existsSync } from 'node:fs';
import path from 'node:path';

import express from 'express';
import { rateLimit } from 'express-rate-limit';

import type { Ctx } from './context';
import { errorHandler, notFoundHandler } from './lib/errors';
import { requireAppVersion } from './middleware/app-version';
import { adminRoutes } from './routes/admin';
import { authRoutes } from './routes/auth';
import { fileRoutes } from './routes/files';
import { gameRoutes } from './routes/game';
import { meRoutes } from './routes/me';
import { socialRoutes } from './routes/social';
import { webhookRoutes } from './routes/webhooks';

export function createApp(ctx: Ctx, opts: { log?: boolean; rateLimit?: boolean; adminPanelDir?: string } = {}) {
  const app = express();
  app.disable('x-powered-by');
  // Behind a load balancer, rate limits must key on the client's IP, not the proxy's.
  if (ctx.env.TRUST_PROXY) app.set('trust proxy', parseTrustProxy(ctx.env.TRUST_PROXY));
  app.set('query parser', 'simple');

  if (opts.log) {
    app.use((req, res, next) => {
      const started = Date.now();
      const path = req.originalUrl.split('?')[0];
      res.on('finish', () => {
        console.log(`${req.method} ${path} ${res.statusCode} ${Date.now() - started}ms`);
      });
      // A connection that drops before the response (e.g. an upload cut off mid-way) would
      // otherwise leave no trace at all.
      res.on('close', () => {
        if (!res.writableFinished) console.log(`${req.method} ${path} aborted after ${Date.now() - started}ms`);
      });
      next();
    });
  }

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  // The admin panel (server/admin/), once built. Same origin as the API, so no CORS.
  if (opts.adminPanelDir && existsSync(path.join(opts.adminPanelDir, 'index.html'))) {
    const dir = opts.adminPanelDir;
    app.use('/admin-panel', express.static(dir, { index: 'index.html' }), (req, res, next) => {
      if (req.method !== 'GET') return next();
      // Client-side routes. `root` so a dot-folder higher up the path (e.g. .claude/) isn't refused.
      res.sendFile('index.html', { root: dir });
    });
  }

  // Photos load in <Image>, so they skip the JSON/version middleware below.
  app.use(fileRoutes(ctx));

  if (opts.rateLimit !== false) {
    const limiter = (limit: number) =>
      rateLimit({
        windowMs: 60_000,
        limit,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        handler: (_req, res) => {
          res.status(429).json({ code: 'rate_limited', message: 'Slow down a little and try again in a minute.' });
        },
      });
    app.use(limiter(120));
    // Sign-in and token refresh are cheap to hammer and expensive to serve (provider token checks).
    app.use('/auth', limiter(20));
  }
  app.use(express.json({ limit: '100kb' }));
  app.use(requireAppVersion(ctx.env.MIN_APP_VERSION));

  app.use(authRoutes(ctx));
  app.use(meRoutes(ctx));
  app.use(gameRoutes(ctx));
  app.use(socialRoutes(ctx));
  app.use(webhookRoutes(ctx));
  app.use(adminRoutes(ctx));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

/** "true" -> trust all, "2" -> hop count, anything else (e.g. "loopback, 10.0.0.0/8") as given. */
export function parseTrustProxy(value: string): boolean | number | string {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return /^\d+$/.test(value) ? Number(value) : value;
}
