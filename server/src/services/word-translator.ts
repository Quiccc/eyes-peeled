import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

import type { WordTranslations } from '../db/schema';
import type { Env } from '../env';
import { SUPPORTED_LOCALES } from '../i18n/locale';
import type { ClaudeClient } from './claude-verifier';

/** Fills in what players see for a word in each language (admin panel → Words). */
export type WordTranslator = {
  translate(label: string): Promise<WordTranslations>;
};

const TARGETS = SUPPORTED_LOCALES.filter((l) => l !== 'en');

const LANGUAGE_NAMES: Record<(typeof TARGETS)[number], string> = {
  es: 'Spanish',
  'pt-BR': 'Brazilian Portuguese',
  fr: 'French',
  de: 'German',
  ja: 'Japanese',
  ko: 'Korean',
  'zh-Hans': 'Simplified Chinese',
  ru: 'Russian',
  it: 'Italian',
  tr: 'Turkish',
  id: 'Indonesian',
  hi: 'Hindi',
};

const SYSTEM_PROMPT = `You translate the names of everyday physical objects for a photo scavenger-hunt game. Players read the name and then go and photograph a real example of the object, so each translation must be the word a native speaker would naturally use for that object in everyday speech, not a dictionary or technical term.

Rules:
- Give the plain noun only: no article, no explanation, no quotation marks.
- Use lower case unless the language's spelling requires capitals (German nouns are capitalized).
- If the English name is ambiguous (for example "remote" or "tie"), translate the meaning a scavenger-hunt player would most likely be looking for around the home or the street.
- Keep it short: one to three words.

Languages: ${TARGETS.map((l) => `${l} = ${LANGUAGE_NAMES[l]}`).join(', ')}.`;

const answer = z.object(Object.fromEntries(TARGETS.map((l) => [l, z.string()])) as Record<(typeof TARGETS)[number], z.ZodString>);

const TIMEOUT_MS = 60_000;

/** Claude when ANTHROPIC_API_KEY is set; otherwise null (the panel says auto-translate is off). */
export function translatorFor(env: Env): WordTranslator | null {
  return env.ANTHROPIC_API_KEY ? claudeTranslator({ apiKey: env.ANTHROPIC_API_KEY, model: env.TRANSLATE_MODEL }) : null;
}

export function claudeTranslator(opts: { model: string; apiKey?: string; client?: ClaudeClient }): WordTranslator {
  const client = opts.client ?? new Anthropic({ apiKey: opts.apiKey, timeout: TIMEOUT_MS, maxRetries: 2 });
  return {
    async translate(label) {
      const response = await client.messages.parse({
        model: opts.model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        output_config: { format: zodOutputFormat(answer), effort: 'low' },
        messages: [{ role: 'user', content: `Object: ${label}` }],
      });
      if (response.stop_reason === 'refusal') throw new Error(`Claude declined to translate "${label}"`);
      const parsed = response.parsed_output;
      if (!parsed) throw new Error(`no usable translation for "${label}" (stop: ${response.stop_reason})`);
      const out: WordTranslations = {};
      for (const l of TARGETS) {
        const value = parsed[l]?.trim();
        if (value) out[l] = value;
      }
      return out;
    },
  };
}
