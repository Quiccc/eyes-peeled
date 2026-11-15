import { z } from 'zod';

/**
 * The HTTP contract with the Python YOLO service (yolo/wordhunt_yolo/api.py). One place for the
 * base URL, the shared key header, timeouts and response validation.
 */

export type YoloHttpOptions = {
  url: string;
  /** Sent as X-Yolo-Key; must match YOLO_KEY in the service's environment. */
  key?: string;
  /** Overrides the per-endpoint default timeout. */
  timeoutMs?: number;
};

/** Photo checks can queue behind others on a CPU box; metadata calls should be quick. */
export const DETECT_TIMEOUT_MS = 30_000;
export const METADATA_TIMEOUT_MS = 5_000;

/** POST /detect → is `label` in the photo, and how sure. Lenient: odd values count as "not detected". */
export const detectResponse = z.object({
  detected: z.boolean().catch(false),
  confidence: z.number().nullable().catch(null),
});

/** GET /classes → every label the model knows. */
export const classesResponse = z.array(z.string());

/** GET /health */
export const healthResponse = z.object({
  ok: z.boolean(),
  model: z.string(),
  modelVersion: z.string(),
  classes: z.number(),
});

export function yoloFetcher(opts: YoloHttpOptions) {
  const base = opts.url.replace(/\/$/, '');
  const headers: Record<string, string> = opts.key ? { 'X-Yolo-Key': opts.key } : {};
  return (path: string, defaultTimeoutMs: number, init: { method?: string; body?: FormData } = {}) =>
    fetch(`${base}${path}`, {
      ...init,
      headers,
      signal: AbortSignal.timeout(opts.timeoutMs ?? defaultTimeoutMs),
    });
}

/** A non-2xx answer from the service. `status` tells "bad request" (4xx) from "service down" (5xx). */
export class YoloHttpError extends Error {
  constructor(
    public path: string,
    public status: number,
  ) {
    super(`YOLO ${path} returned ${status}`);
  }
}
