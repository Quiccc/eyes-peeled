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

export function createApp(ctx: Ctx, opts: { log?: boolean; rateLimit?: boolean; adminPanelDir?: string } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('query parser', 'simple');

  if (opts.log) {
    app.use((req, res, next) => {
      const started = Date.now();
      res.on('finish', () => {
        const path = req.originalUrl.split('?')[0];
        console.log(`${req.method} ${path} ${res.statusCode} ${Date.now() - started}ms`);
      });
      next();
    });
  }

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  // The admin panel (admin/), once built. Same origin as the API, so no CORS.
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
    app.use(
      rateLimit({
        windowMs: 60_000,
        limit: 120,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        handler: (_req, res) => {
          res.status(429).json({ code: 'rate_limited', message: 'Slow down a little and try again in a minute.' });
        },
      }),
    );
  }
  app.use(express.json({ limit: '100kb' }));
  app.use(requireAppVersion(ctx.env.MIN_APP_VERSION));

  app.use(authRoutes(ctx));
  app.use(meRoutes(ctx));
  app.use(gameRoutes(ctx));
  app.use(socialRoutes(ctx));
  app.use(adminRoutes(ctx));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
