import type { RequestHandler } from 'express';

import { HttpError } from '../lib/errors';

const parse = (v: string) => v.split(/[.+-]/).slice(0, 3).map((n) => Number.parseInt(n, 10) || 0);

/** -1 / 0 / 1 for semver-ish "1.2.3" strings. */
export function compareVersions(a: string, b: string): number {
  const x = parse(a);
  const y = parse(b);
  for (let i = 0; i < 3; i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d) return Math.sign(d);
  }
  return 0;
}

/** 426 for apps older than `minVersion`. Requests without the header (curl, webhooks) pass. */
export function requireAppVersion(minVersion: string | undefined): RequestHandler {
  return (req, _res, next) => {
    const version = req.get('x-app-version');
    if (minVersion && version && compareVersions(version, minVersion) < 0) {
      throw new HttpError(426, 'upgrade_required', 'A new version of Word Hunt is available. Please update to keep playing.');
    }
    next();
  };
}
