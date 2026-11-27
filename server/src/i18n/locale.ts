import { AsyncLocalStorage } from 'node:async_hooks';

import type { RequestHandler } from 'express';

import type { Locale } from '@shared/types';

/** Every language the API answers in. Must list each member of `Locale` exactly once. */
export const SUPPORTED_LOCALES = [
  'en',
  'es',
  'pt-BR',
  'fr',
  'de',
  'ja',
  'ko',
  'zh-Hans',
  'ru',
  'it',
  'tr',
  'id',
  'hi',
] as const satisfies readonly Locale[];

// Compile-time check that no Locale is missing from the list above.
type Missing = Exclude<Locale, (typeof SUPPORTED_LOCALES)[number]>;
const _allListed: Missing extends never ? true : Missing = true;
void _allListed;

export const DEFAULT_LOCALE: Locale = 'en';

/** Each supported language has one entry per primary subtag, so matching is by that subtag. */
const BY_LANGUAGE = new Map<string, Locale>(SUPPORTED_LOCALES.map((l) => [l.split('-')[0]!.toLowerCase(), l]));
// Old Android code for Indonesian.
BY_LANGUAGE.set('in', 'id');

/**
 * The supported locale for one BCP 47 tag, or null. Matches on the language only, so `pt-PT` gets
 * Brazilian Portuguese and `zh-Hant-TW` gets Simplified Chinese: the closest we have.
 * Keep in step with matchLocale in mobile/src/i18n/languages.ts.
 */
export function matchLocale(tag: string): Locale | null {
  const language = tag.trim().split(/[-_]/)[0]?.toLowerCase();
  return (language && BY_LANGUAGE.get(language)) || null;
}

/** The best supported locale for an Accept-Language header ("es-MX,es;q=0.9,en;q=0.8"). */
export function localeFromHeader(header: string | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;
  const ranked = header
    .split(',')
    .map((part, i) => {
      const [tag = '', ...params] = part.split(';');
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      const weight = q ? Number(q.slice(2)) : 1;
      return { tag: tag.trim(), weight: Number.isFinite(weight) ? weight : 0, i };
    })
    .filter((r) => r.tag && r.tag !== '*' && r.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.i - b.i);
  for (const r of ranked) {
    const match = matchLocale(r.tag);
    if (match) return match;
  }
  return DEFAULT_LOCALE;
}

const storage = new AsyncLocalStorage<Locale>();

/** The language of the request being handled; English outside a request (e.g. the photo worker). */
export function currentLocale(): Locale {
  return storage.getStore() ?? DEFAULT_LOCALE;
}

/** Reads Accept-Language once per request; currentLocale() returns it for the rest of the request. */
export const localeMiddleware: RequestHandler = (req, res, next) => {
  const locale = localeFromHeader(req.get('accept-language'));
  res.locals.locale = locale;
  res.setHeader('Content-Language', locale);
  res.vary('Accept-Language');
  storage.run(locale, next);
};

/** The locale of a request, for handlers that run outside its async context (error handler). */
export function localeOf(res: { locals: Record<string, unknown> }): Locale {
  return (res.locals.locale as Locale | undefined) ?? currentLocale();
}
