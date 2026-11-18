import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';

import { claudeVerifier, type ClaudeClient } from '../src/services/claude-verifier';
import { jpeg } from './helpers';

type Answer = { detected: boolean; confidence: number; reason: string } | null;

/** A fake SDK client that answers every call with `answer` and remembers what it was asked. */
function fakeClient(answer: Answer, stop_reason = 'end_turn') {
  const parse = vi.fn(async (_params: unknown) => ({ stop_reason, parsed_output: answer }));
  return { client: { messages: { parse } } as unknown as ClaudeClient, parse };
}

const png = () => Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

describe('claudeVerifier', () => {
  it('sends the photo and the word, and maps the answer to a verdict', async () => {
    const { client, parse } = fakeClient({ detected: true, confidence: 0.92, reason: 'A white mug on a desk.' });
    const verdict = await claudeVerifier({ model: 'claude-haiku-5-5', client }).verify(jpeg(), 'cup');

    expect(verdict).toEqual({ detected: true, confidence: 0.92, reason: 'A white mug on a desk.' });
    const params = parse.mock.calls[0]![0] as Anthropic.MessageCreateParams;
    expect(params.model).toBe('claude-haiku-5-5');
    const [image, text] = params.messages[0]!.content as Anthropic.ContentBlockParam[];
    expect(image).toMatchObject({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg' } });
    expect(text).toMatchObject({ type: 'text', text: 'Target word: cup' });
  });

  it('detects PNG photos too', async () => {
    const { client, parse } = fakeClient({ detected: false, confidence: 0.1, reason: 'Only a table.' });
    await claudeVerifier({ model: 'm', client }).verify(png(), 'cup');
    const params = parse.mock.calls[0]![0] as Anthropic.MessageCreateParams;
    expect((params.messages[0]!.content as Anthropic.ImageBlockParam[])[0]!.source).toMatchObject({ media_type: 'image/png' });
  });

  it('keeps confidence between 0 and 1', async () => {
    const { client } = fakeClient({ detected: true, confidence: 1.4, reason: 'Clearly a cup.' });
    expect((await claudeVerifier({ model: 'm', client }).verify(jpeg(), 'cup')).confidence).toBe(1);
  });

  it('counts a refusal or an unreadable answer as not found', async () => {
    const refused = fakeClient(null, 'refusal');
    expect(await claudeVerifier({ model: 'm', client: refused.client }).verify(jpeg(), 'cup')).toMatchObject({
      detected: false,
      confidence: null,
    });
    const cutOff = fakeClient(null, 'max_tokens');
    expect((await claudeVerifier({ model: 'm', client: cutOff.client }).verify(jpeg(), 'cup')).detected).toBe(false);
  });

  it('throws on API errors, so the photo is marked error and costs no try', async () => {
    const parse = vi.fn(async () => {
      throw new Anthropic.InternalServerError(500, undefined, 'overloaded', new Headers());
    });
    const client = { messages: { parse } } as unknown as ClaudeClient;
    await expect(claudeVerifier({ model: 'm', client }).verify(jpeg(), 'cup')).rejects.toThrow();
  });

  it('rejects files that are not images without calling Claude', async () => {
    const { client, parse } = fakeClient({ detected: true, confidence: 1, reason: '' });
    await expect(claudeVerifier({ model: 'm', client }).verify(Buffer.from('hello'), 'cup')).rejects.toThrow(/not a JPEG/);
    expect(parse).not.toHaveBeenCalled();
  });
});
