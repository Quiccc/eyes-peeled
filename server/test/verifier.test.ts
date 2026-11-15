import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import express from 'express';
import multer from 'multer';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { httpYoloVerifier } from '../src/services/verifier';

/** Stands in for yolo/main.py: "detects" whatever label is written inside the image bytes. */
let server: Server;
let url: string;
let seenKey: string | undefined;

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
