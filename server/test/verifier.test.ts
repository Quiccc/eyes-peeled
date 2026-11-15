import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import express from 'express';
import multer from 'multer';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CLASSES_TTL_MS, httpModelInfo } from '../src/services/model-info';
import { httpYoloVerifier } from '../src/services/verifier';

/** Stands in for yolo/main.py: "detects" whatever label is written inside the image bytes. */
let server: Server;
let url: string;
let seenKey: string | undefined;
let classCalls = 0;
let hasReport = false;

beforeAll(async () => {
  const app = express();
  app.post('/detect', multer().single('image'), (req, res) => {
    seenKey = req.get('x-yolo-key');
    if (req.body.label === 'boom') {
      res.status(500).end();
      return;
    }
    const detected = req.file?.buffer.toString().includes(req.body.label) ?? false;
    res.json({ detected, confidence: detected ? 0.91 : 0.05, labels: [] });
  });
  app.get('/classes', (req, res) => {
    classCalls += 1;
    seenKey = req.get('x-yolo-key');
    res.json(['Cup', 'chair']);
  });
  app.get('/health', (_req, res) => {
    res.json({ ok: true, model: 'best.pt', modelVersion: 'v2', classes: 2 });
  });
  app.get('/eval/report', (_req, res) => {
    if (hasReport) res.json({ modelVersion: 'v2', words: [] });
    else res.status(404).json({ detail: 'no report' });
  });
  server = createServer(app);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

describe('httpYoloVerifier', () => {
  const verifier = () => httpYoloVerifier({ url, key: 'k1' });

  it('sends the image, label and key, and reads the verdict', async () => {
    expect(await verifier().verify(Buffer.from('a photo of a cup'), 'cup')).toEqual({ detected: true, confidence: 0.91 });
    expect(seenKey).toBe('k1');
    expect(await verifier().verify(Buffer.from('a photo of a cup'), 'bicycle')).toEqual({
      detected: false,
      confidence: 0.05,
    });
  });

  it('throws when the service fails, so the submission is marked "try again"', async () => {
    await expect(verifier().verify(Buffer.from('x'), 'boom')).rejects.toThrow(/500/);
  });
});

describe('httpModelInfo', () => {
  it('lower-cases the labels, sends the key, and caches them for a minute', async () => {
    let now = 1_000_000;
    const model = httpModelInfo({ url, key: 'k2', now: () => now });
    classCalls = 0;
    expect(await model.classes()).toEqual(new Set(['cup', 'chair']));
    expect(seenKey).toBe('k2');
    await model.classes();
    expect(classCalls).toBe(1);
    now += CLASSES_TTL_MS + 1;
    await model.classes();
    expect(classCalls).toBe(2);
  });

  it('reads health, and a missing word-test report is null', async () => {
    const model = httpModelInfo({ url });
    expect(await model.health()).toEqual({ ok: true, model: 'best.pt', modelVersion: 'v2', classes: 2 });
    hasReport = false;
    expect(await model.report()).toBeNull();
    hasReport = true;
    expect(await model.report()).toMatchObject({ modelVersion: 'v2' });
  });

  it('throws when the service is unreachable', async () => {
    const model = httpModelInfo({ url: 'http://127.0.0.1:9', timeoutMs: 2_000 });
    await expect(model.classes()).rejects.toThrow();
  });
});
