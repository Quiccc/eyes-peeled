/**
 * What the YOLO service's model knows, for scheduling checks and the admin panel.
 * Separate from the Verifier (which only judges photos) so tests can fake each one.
 */
export type ModelHealth = { ok: boolean; model: string; modelVersion: string; classes: number };

export type ModelInfo = {
  /** True when a real YOLO service is configured. When false, label checks are skipped. */
  readonly configured: boolean;
  /** Lower-cased labels the model knows, or null when not configured. Throws if the service is down. */
  classes(): Promise<Set<string> | null>;
  health(): Promise<ModelHealth | null>;
  /** Latest word-test report (yolo/eval), or null if there is none. */
  report(): Promise<unknown | null>;
};

const CLASSES_TTL_MS = 60_000;

export function httpModelInfo(opts: { url: string; key?: string; timeoutMs?: number }): ModelInfo {
  const base = opts.url.replace(/\/$/, '');
  const get = (path: string) =>
    fetch(`${base}${path}`, {
      headers: opts.key ? { 'X-Yolo-Key': opts.key } : {},
      signal: AbortSignal.timeout(opts.timeoutMs ?? 5_000),
    });
  let cached: { at: number; labels: Set<string> } | null = null;

  return {
    configured: true,
    async classes() {
      if (cached && Date.now() - cached.at < CLASSES_TTL_MS) return cached.labels;
      const res = await get('/classes');
      if (!res.ok) throw new Error(`YOLO /classes returned ${res.status}`);
      const labels = new Set(((await res.json()) as string[]).map((l) => l.toLowerCase()));
      cached = { at: Date.now(), labels };
      return labels;
    },
    async health() {
      const res = await get('/health');
      if (!res.ok) throw new Error(`YOLO /health returned ${res.status}`);
      return (await res.json()) as ModelHealth;
    },
    async report() {
      const res = await get('/eval/report');
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`YOLO /eval/report returned ${res.status}`);
      return res.json();
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
    report: async () => extra.report ?? null,
  };
}
