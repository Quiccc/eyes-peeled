import { DETECT_TIMEOUT_MS, detectResponse, yoloFetcher, YoloHttpError, type YoloHttpOptions } from './yolo-http';

/** Checks whether a photo shows the target object. */
export type Verdict = { detected: boolean; confidence: number | null };

export type Verifier = {
  verify(image: Buffer, label: string): Promise<Verdict>;
};

/** Talks to the Python YOLO service in yolo/. */
export function httpYoloVerifier(opts: YoloHttpOptions): Verifier {
  const request = yoloFetcher(opts);
  return {
    async verify(image, label) {
      const form = new FormData();
      form.append('image', new Blob([new Uint8Array(image)], { type: 'image/jpeg' }), 'photo.jpg');
      form.append('label', label);
      const res = await request('/detect', DETECT_TIMEOUT_MS, { method: 'POST', body: form });
      if (!res.ok) throw new YoloHttpError('/detect', res.status);
      return detectResponse.parse(await res.json());
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
