import type { Env } from '../env';
import { httpModelInfo, type ModelInfo, noModelInfo } from './model-info';
import { httpYoloVerifier, stubVerifier, type Verifier } from './verifier';

/**
 * The photo verifier and model info for the configured YOLO service, built from the same settings.
 * Without YOLO_URL: the random stub verifier and no label checks.
 */
export function yoloClients(env: Pick<Env, 'YOLO_URL' | 'YOLO_KEY'>): { verifier: Verifier; model: ModelInfo } {
  if (!env.YOLO_URL) return { verifier: stubVerifier(), model: noModelInfo() };
  const opts = { url: env.YOLO_URL, key: env.YOLO_KEY };
  return { verifier: httpYoloVerifier(opts), model: httpModelInfo(opts) };
}
