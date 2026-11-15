/** Checks whether a photo shows the target object. */
export type Verdict = { detected: boolean; confidence: number | null };

export type Verifier = {
  verify(image: Buffer, label: string): Promise<Verdict>;
};

/** Talks to the Python YOLO service in yolo/. */
export function httpYoloVerifier(opts: { url: string; key?: string; timeoutMs?: number }): Verifier {
  return {
    async verify(image, label) {
      const form = new FormData();
      form.append('image', new Blob([new Uint8Array(image)], { type: 'image/jpeg' }), 'photo.jpg');
      form.append('label', label);
      const res = await fetch(`${opts.url.replace(/\/$/, '')}/detect`, {
        method: 'POST',
        body: form,
        headers: opts.key ? { 'X-Yolo-Key': opts.key } : {},
        signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
      });
      if (!res.ok) throw new Error(`YOLO service returned ${res.status}`);
      const body = (await res.json()) as { detected?: unknown; confidence?: unknown };
      return {
        detected: body.detected === true,
        confidence: typeof body.confidence === 'number' ? body.confidence : null,
      };
    },
  };
}

/**
 * Stand-in until the YOLO service runs: accepts about 60% of photos, like the app's mock.
 * Tests pass `decide` to control the outcome.
 */
export function stubVerifier(decide?: (label: string) => Verdict | Promise<Verdict>): Verifier {
  return {
    async verify(_image, label) {
      if (decide) return decide(label);
      const detected = Math.random() < 0.6;
      return { detected, confidence: detected ? 0.8 + Math.random() * 0.15 : 0.1 + Math.random() * 0.3 };
    },
  };
}
