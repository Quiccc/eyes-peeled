import type { Env } from '../env';
import { claudeVerifier } from './claude-verifier';

/** Checks whether a photo shows the target object. `reason` is for the server log only. */
export type Verdict = { detected: boolean; confidence: number | null; reason?: string };

export type Verifier = {
  verify(image: Buffer, label: string): Promise<Verdict>;
};

/** Claude when ANTHROPIC_API_KEY is set, otherwise the random stub (local dev). */
export function verifierFor(env: Env): Verifier {
  return env.ANTHROPIC_API_KEY
    ? claudeVerifier({ apiKey: env.ANTHROPIC_API_KEY, model: env.VERIFY_MODEL })
    : stubVerifier();
}

/**
 * Stand-in when no API key is set: accepts about 60% of photos, like the app's mock.
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
