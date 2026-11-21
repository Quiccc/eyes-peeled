import { createHmac } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { safeEqual } from '../lib/safe-equal';

/** Photo storage. Local disk for now; swap for S3/R2 by implementing this interface. */
export type Storage = {
  put(key: string, data: Buffer): Promise<void>;
  read(key: string): Promise<Buffer>;
  /** Delete one file, or everything under a prefix ending in '/'. Missing files are fine. */
  delete(keyOrPrefix: string): Promise<void>;
  /** Short-lived URL the app can load without an Authorization header. */
  signedUrl(key: string): string;
  /**
   * Longer-lived URL for a profile picture. The app keeps the signed-in user for as long as it stays
   * open, so these last 7 to 8 days. `exp` is rounded up to the next UTC midnight, so the URL stays
   * the same all day and image caches keep working.
   */
  avatarUrl(key: string): string;
  /** Absolute path of a file, when the signature in `query` is valid and unexpired; otherwise null. */
  resolveSigned(key: string, exp: string | undefined, sig: string | undefined): string | null;
};

const URL_TTL_SEC = 60 * 60;
const AVATAR_TTL_SEC = 7 * 24 * 60 * 60;
const DAY_SEC = 24 * 60 * 60;
const SAFE_KEY = /^[a-zA-Z0-9_-]+(\/[a-zA-Z0-9_-]+)*\.jpg$/;

export function localStorage(opts: { dir: string; baseUrl: string; secret: string; now: () => Date }): Storage {
  const root = path.resolve(opts.dir);
  const sign = (key: string, exp: number) => createHmac('sha256', opts.secret).update(`${key}:${exp}`).digest('base64url');
  const urlFor = (key: string, exp: number) =>
    `${opts.baseUrl.replace(/\/$/, '')}/files/${key}?exp=${exp}&sig=${sign(key, exp)}`;
  const fileFor = (key: string) => {
    const full = path.resolve(root, key);
    if (!full.startsWith(root + path.sep)) throw new Error(`Bad storage key: ${key}`);
    return full;
  };

  return {
    async put(key, data) {
      if (!SAFE_KEY.test(key)) throw new Error(`Bad storage key: ${key}`);
      const file = fileFor(key);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, data);
    },
    async read(key) {
      return readFile(fileFor(key));
    },
    async delete(keyOrPrefix) {
      await rm(fileFor(keyOrPrefix.replace(/\/$/, '')), { recursive: true, force: true });
    },
    signedUrl(key) {
      return urlFor(key, Math.floor(opts.now().getTime() / 1000) + URL_TTL_SEC);
    },
    avatarUrl(key) {
      const min = Math.floor(opts.now().getTime() / 1000) + AVATAR_TTL_SEC;
      return urlFor(key, Math.ceil(min / DAY_SEC) * DAY_SEC);
    },
    resolveSigned(key, exp, sig) {
      if (!SAFE_KEY.test(key) || !exp || !sig || !/^\d+$/.test(exp)) return null;
      if (Number(exp) < opts.now().getTime() / 1000) return null;
      if (!safeEqual(sign(key, Number(exp)), sig)) return null;
      return fileFor(key);
    },
  };
}
