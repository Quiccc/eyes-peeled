import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';

import type { ClaudeClient } from '../src/services/claude-verifier';
import { claudeTranslator } from '../src/services/word-translator';

function fakeClient(answer: Record<string, string> | null, stop_reason = 'end_turn') {
  const parse = vi.fn(async (_params: unknown) => ({ stop_reason, parsed_output: answer }));
  return { client: { messages: { parse } } as unknown as ClaudeClient, parse };
}

describe('claudeTranslator', () => {
  it('asks for the English label and keeps the non-empty translations', async () => {
    const { client, parse } = fakeClient({ es: ' taza ', de: 'Tasse', fr: '', ja: 'カップ' });
    const out = await claudeTranslator({ model: 'claude-opus-5-5', client }).translate('cup');

    expect(out).toEqual({ es: 'taza', de: 'Tasse', ja: 'カップ' });
    const params = parse.mock.calls[0]![0] as Anthropic.MessageCreateParams;
    expect(params.model).toBe('claude-opus-5-5');
    expect(params.messages[0]).toEqual({ role: 'user', content: 'Object: cup' });
    expect(params.system).toContain('pt-BR = Brazilian Portuguese');
  });

  it('fails on a refusal or an unreadable answer, so the word keeps its translations', async () => {
    await expect(claudeTranslator({ model: 'm', client: fakeClient(null, 'refusal').client }).translate('x')).rejects.toThrow(/declined/);
    await expect(claudeTranslator({ model: 'm', client: fakeClient(null, 'max_tokens').client }).translate('x')).rejects.toThrow(
      /no usable translation/,
    );
  });
});
