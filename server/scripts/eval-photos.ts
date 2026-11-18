/**
 * Runs real photos through the production photo check (claudeVerifier) and reports accuracy,
 * a suggested confidence threshold, and cost per photo.
 *
 *   npm run eval:photos -- [dir] [--model M] [--concurrency N] [--players N] [--price-in $] [--price-out $]
 *
 * Layout (dir defaults to ./eval-photos):
 *   <word>/match/*.jpg       should pass
 *   <word>/near-miss/*.jpg   a similar but different object, should fail
 *   <word>/screen/*.jpg      the word on a screen or printout, should fail
 *
 * Photos are downscaled like the app does (mobile/src/features/hunt/prepare-photo.ts) before upload.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';

import { loadEnv } from '../src/env';
import { claudeVerifier, type ClaudeClient } from '../src/services/claude-verifier';
import { passes } from '../src/services/verification';
import type { Verdict } from '../src/services/verifier';

/** Same as the app: longest edge 1280 px, JPEG quality 80. */
const MAX_EDGE = 1280;
const JPEG_QUALITY = 80;
const THRESHOLDS = [0.5, 0.6, 0.7, 0.8, 0.9];
/** Photos a player takes per day, for the daily cost projection (3 words, a retry or two). */
const PHOTOS_PER_PLAYER_PER_DAY = 3;

/** $ per million tokens, input / output (Anthropic API list prices, 2026-11). */
const PRICES: Record<string, [number, number]> = {
  'claude-haiku-5-5': [0.1, 0.5],
  'claude-sonnet-5-5': [2, 10],
  'claude-opus-5-5': [4, 20],
};

const BUCKETS = ['match', 'near-miss', 'screen'] as const;
type Bucket = (typeof BUCKETS)[number];
const IMAGE_EXT = /\.(jpe?g|png|webp|heic|heif|gif|tiff?)$/i;

type Photo = { word: string; bucket: Bucket; file: string };
type Usage = { inputTokens: number; outputTokens: number };
type Result = Photo & { verdict: Verdict; usage: Usage; ms: number; bytes: number };
type Failure = Photo & { error: string };

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    model: { type: 'string' },
    concurrency: { type: 'string', default: '4' },
    players: { type: 'string', default: '1000' },
    'price-in': { type: 'string' },
    'price-out': { type: 'string' },
  },
});

async function findPhotos(dir: string): Promise<Photo[]> {
  const photos: Photo[] = [];
  for (const word of await readdir(dir, { withFileTypes: true })) {
    if (!word.isDirectory()) continue;
    for (const bucket of BUCKETS) {
      const bucketDir = path.join(dir, word.name, bucket);
      const files = await readdir(bucketDir).catch(() => [] as string[]);
      for (const f of files) {
        if (IMAGE_EXT.test(f)) photos.push({ word: word.name, bucket, file: path.join(bucketDir, f) });
      }
    }
  }
  return photos;
}

/** Downscale and re-encode like the app. `rotate()` applies the EXIF orientation first. */
async function prepare(file: string): Promise<Buffer> {
  return sharp(await readFile(file))
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();
}

/** A client whose messages.parse records usage, so each photo's tokens can be counted. */
function recordingClient(real: Anthropic, onUsage: (u: Usage) => void): ClaudeClient {
  const messages = Object.create(real.messages) as Anthropic['messages'];
  const parse = real.messages.parse.bind(real.messages);
  messages.parse = (async (...args: Parameters<typeof parse>) => {
    const response = await parse(...args);
    onUsage({ inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens });
    return response;
  }) as typeof parse;
  return { messages };
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!, i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

const shouldPass = (b: Bucket) => b === 'match';
const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : '-');
const usd = (n: number) => `$${n < 0.01 ? n.toFixed(5) : n.toFixed(2)}`;

async function main() {
  const env = loadEnv();
  if (!env.ANTHROPIC_API_KEY) throw new Error('Set ANTHROPIC_API_KEY in server/.env first.');
  const model = opts.model ?? env.VERIFY_MODEL;
  const threshold = env.VERIFY_MIN_CONFIDENCE;
  const dir = path.resolve(positionals[0] ?? 'eval-photos');

  const photos = await findPhotos(dir);
  if (!photos.length) {
    throw new Error(`No photos in ${dir}. Expected <word>/{${BUCKETS.join(',')}}/*.jpg`);
  }
  console.log(`${photos.length} photos, model ${model}, current threshold ${threshold}\n`);

  const real = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 30_000, maxRetries: 2 });
  const results: Result[] = [];
  const failures: Failure[] = [];

  await mapLimit(photos, Number(opts.concurrency), async (photo, i) => {
    try {
      const image = await prepare(photo.file);
      let usage: Usage = { inputTokens: 0, outputTokens: 0 };
      const verifier = claudeVerifier({ model, client: recordingClient(real, (u) => (usage = u)) });
      const start = Date.now();
      const verdict = await verifier.verify(image, photo.word);
      results.push({ ...photo, verdict, usage, ms: Date.now() - start, bytes: image.length });
    } catch (err) {
      failures.push({ ...photo, error: err instanceof Error ? err.message : String(err) });
    }
    process.stdout.write(`\r${i + 1}/${photos.length}`);
  });
  process.stdout.write('\n\n');

  const printFailures = () => {
    console.log(`\n${failures.length} photos failed (not counted above):`);
    for (const f of failures) console.log(`  ${f.word}/${f.bucket}/${path.basename(f.file)}: ${f.error}`);
  };
  if (!results.length) {
    printFailures();
    throw new Error('Every photo failed; nothing to report.');
  }

  results.sort((a, b) => a.word.localeCompare(b.word) || a.bucket.localeCompare(b.bucket) || a.file.localeCompare(b.file));

  // Per photo
  console.table(
    results.map((r) => {
      const passed = passes(r.verdict, threshold);
      return {
        word: r.word,
        bucket: r.bucket,
        file: path.basename(r.file),
        detected: r.verdict.detected,
        conf: r.verdict.confidence?.toFixed(2) ?? '-',
        pass: passed,
        ok: passed === shouldPass(r.bucket) ? '' : 'WRONG',
        tokens: `${r.usage.inputTokens}/${r.usage.outputTokens}`,
        ms: r.ms,
        reason: r.verdict.reason,
      };
    }),
  );

  // Per threshold: false rejects on match, false accepts on near-miss/screen
  const count = (b: Bucket) => results.filter((r) => r.bucket === b).length;
  const rows = THRESHOLDS.map((t) => {
    const wrong = (b: Bucket) => results.filter((r) => r.bucket === b && passes(r.verdict, t) !== shouldPass(b)).length;
    const errors = BUCKETS.reduce((n, b) => n + wrong(b), 0);
    return {
      threshold: t,
      'match rejected': `${wrong('match')}/${count('match')}`,
      'near-miss accepted': `${wrong('near-miss')}/${count('near-miss')}`,
      'screen accepted': `${wrong('screen')}/${count('screen')}`,
      accuracy: pct(results.length - errors, results.length),
      errors,
    };
  });
  console.log('\nBy threshold');
  console.table(rows);
  // Fewest errors; ties go to the stricter threshold (a false accept is worse than a retry).
  const best = rows.reduce((a, b) => (b.errors <= a.errors ? b : a));
  console.log(`Suggested VERIFY_MIN_CONFIDENCE: ${best.threshold} (current ${threshold})`);

  // Cost
  const [priceIn, priceOut] = [
    opts['price-in'] ? Number(opts['price-in']) : PRICES[model]?.[0],
    opts['price-out'] ? Number(opts['price-out']) : PRICES[model]?.[1],
  ];
  const avg = (f: (r: Result) => number) => (results.length ? results.reduce((n, r) => n + f(r), 0) / results.length : 0);
  const avgIn = avg((r) => r.usage.inputTokens);
  const avgOut = avg((r) => r.usage.outputTokens);
  console.log(
    `\nAvg per photo: ${Math.round(avgIn)} input + ${Math.round(avgOut)} output tokens, ` +
      `${Math.round(avg((r) => r.bytes) / 1024)} KB, ${Math.round(avg((r) => r.ms))} ms`,
  );
  if (priceIn === undefined || priceOut === undefined) {
    console.log(`No price known for ${model}; pass --price-in and --price-out ($ per million tokens).`);
  } else {
    const perPhoto = (avgIn * priceIn + avgOut * priceOut) / 1e6;
    const players = Number(opts.players);
    const perDay = perPhoto * players * PHOTOS_PER_PLAYER_PER_DAY;
    console.log(`Cost: ${usd(perPhoto)} per photo, ${usd(perPhoto * 1000)} per 1000 photos`);
    console.log(
      `At ${players} players × ${PHOTOS_PER_PLAYER_PER_DAY} photos/day: ${usd(perDay)}/day, ${usd(perDay * 30)}/month`,
    );
  }

  if (failures.length) printFailures();

  const out = path.join(dir, `results-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  await writeFile(out, JSON.stringify({ model, threshold, results, failures }, null, 2));
  console.log(`\nRaw results: ${out}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
