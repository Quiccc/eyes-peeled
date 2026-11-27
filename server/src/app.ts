import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';

import express from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';

import type { Ctx } from './context';
import { localeMiddleware, localeOf } from './i18n/locale';
import { translate } from './i18n/messages';
import { errorHandler, notFoundHandler } from './lib/errors';
import { logger } from './lib/logger';
import { requireAppVersion } from './middleware/app-version';
import { adminRoutes } from './routes/admin';
import { authRoutes } from './routes/auth';
import { fileRoutes } from './routes/files';
import { gameRoutes } from './routes/game';
import { meRoutes } from './routes/me';
import { socialRoutes } from './routes/social';
import { webhookRoutes } from './routes/webhooks';

export function createApp(ctx: Ctx, opts: { rateLimit?: boolean; adminPanelDir?: string } = {}) {
  const app = express();
  app.disable('x-powered-by');
  // Behind a load balancer, rate limits must key on the client's IP, not the proxy's.
  if (ctx.env.TRUST_PROXY) app.set('trust proxy', parseTrustProxy(ctx.env.TRUST_PROXY));
  app.set('query parser', 'simple');

  // Every response carries an x-request-id (the caller's, or a new one); it is on every log line
  // for that request, so a user's report can be traced in `docker compose logs`.
  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const incoming = req.headers['x-request-id'];
        const id = typeof incoming === 'string' && /^[\w-]{1,64}$/.test(incoming) ? incoming : randomUUID();
        res.setHeader('x-request-id', id);
        return id;
      },
      autoLogging: { ignore: (req) => req.url === '/health' },
      // Never log tokens or cookies.
      serializers: {
        req: (req: { id: unknown; method: string; url: string }) => ({ id: req.id, method: req.method, url: req.url.split('?')[0] }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
      customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
    }),
  );
  // Accept-Language -> currentLocale() for the rest of the request (words, verdicts, errors).
  app.use(localeMiddleware);
  // Photos are shown in the app's <Image> and the admin panel, so they may load cross-origin.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

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

  if (opts.rateLimit !== false) {
    const limiter = (limit: number, extra: Partial<Parameters<typeof rateLimit>[0]> = {}) =>
      rateLimit({
        ...extra,
        windowMs: 60_000,
        limit,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        handler: (_req, res) => {
          const message = translate('Slow down a little and try again in a minute.', undefined, localeOf(res));
          res.status(429).json({ code: 'rate_limited', message });
        },
      });
    // Photos get their own, larger budget: a feed or leaderboard loads many at once.
    app.use('/files', limiter(600));
    const general = limiter(120);
    app.use((req, res, next) => (req.path.startsWith('/files/') ? next() : general(req, res, next)));
    // Sign-in and token refresh are cheap to hammer and expensive to serve (provider token checks).
    app.use('/auth', limiter(20));
    // A wrong admin token gets a 404; only those count, so guessing is slow and real use isn't.
    app.use('/admin', limiter(10, { skipSuccessfulRequests: true, requestWasSuccessful: (_req, res) => res.statusCode !== 404 }));
  }

  // Photos load in <Image>, so they skip the JSON/version middleware below.
  app.use(fileRoutes(ctx));

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
