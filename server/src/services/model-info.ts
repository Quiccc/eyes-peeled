import type { EvalReport, ModelHealth } from '../dto/admin';
import { classesResponse, healthResponse, METADATA_TIMEOUT_MS, yoloFetcher, YoloHttpError, type YoloHttpOptions } from './yolo-http';

export type { ModelHealth };

/**
 * What the YOLO service's model knows, for scheduling checks and the admin panel.
 * Separate from the Verifier (which only judges photos) so tests can fake each one.
 */
export type ModelInfo = {
  /** True when a real YOLO service is configured. When false, label checks are skipped. */
  readonly configured: boolean;
  /** Lower-cased labels the model knows, or null when not configured. Throws if the service is down. */
  classes(): Promise<Set<string> | null>;
  health(): Promise<ModelHealth | null>;
  /** Latest word-test report (yolo/eval), or null if there is none. */
  report(): Promise<EvalReport | null>;
};

/** The label list changes only when a new model is deployed; don't ask on every scheduling call. */
export const CLASSES_TTL_MS = 60_000;

export function httpModelInfo(opts: YoloHttpOptions & { now?: () => number }): ModelInfo {
  const request = yoloFetcher(opts);
  const now = opts.now ?? Date.now;
  const get = async (path: string) => {
    const res = await request(path, METADATA_TIMEOUT_MS);
    if (!res.ok && res.status !== 404) throw new YoloHttpError(path, res.status);
    return res;
  };
  let cached: { at: number; labels: Set<string> } | null = null;

  return {
    configured: true,
    async classes() {
      if (cached && now() - cached.at < CLASSES_TTL_MS) return cached.labels;
      const res = await get('/classes');
      if (!res.ok) throw new YoloHttpError('/classes', res.status);
      const labels = new Set(classesResponse.parse(await res.json()).map((l) => l.toLowerCase()));
      cached = { at: now(), labels };
      return labels;
    },
    async health() {
      const res = await get('/health');
      if (!res.ok) throw new YoloHttpError('/health', res.status);
      return healthResponse.parse(await res.json());
    },
    async report() {
      const res = await get('/eval/report');
      if (res.status === 404) return null;
      // Written by yolo/eval/evaluate.py and only displayed, so it's passed through as is.
      return (await res.json()) as EvalReport;
    },
  };
}

/** No YOLO service (stub verifier): every label is allowed, nothing to report. */
export function noModelInfo(): ModelInfo {
  return {
    configured: false,
    classes: async () => null,
    health: async () => null,
    report: async () => null,
  };
}

/** For tests: a model that knows exactly `labels`. */
export function fakeModelInfo(labels: string[], extra: { report?: unknown } = {}): ModelInfo {
  return {
    configured: true,
    classes: async () => new Set(labels.map((l) => l.toLowerCase())),
    health: async () => ({ ok: true, model: 'fake.pt', modelVersion: 'fake', classes: labels.length }),
    report: async () => (extra.report as EvalReport | undefined) ?? null,
  };
}
