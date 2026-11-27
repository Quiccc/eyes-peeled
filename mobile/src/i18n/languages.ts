import type { Locale } from '@/api/types';

/**
 * The app's languages, each with its name written in that language (for the Language screen).
 * Must list each member of `Locale` once; the server lists the same ones (server/src/i18n/locale.ts).
 */
export const LANGUAGES = [
  { locale: 'en', name: 'English' },
  { locale: 'es', name: 'Español' },
  { locale: 'pt-BR', name: 'Português (Brasil)' },
  { locale: 'fr', name: 'Français' },
  { locale: 'de', name: 'Deutsch' },
  { locale: 'it', name: 'Italiano' },
  { locale: 'tr', name: 'Türkçe' },
  { locale: 'ru', name: 'Русский' },
  { locale: 'id', name: 'Bahasa Indonesia' },
  { locale: 'hi', name: 'हिन्दी' },
  { locale: 'ja', name: '日本語' },
  { locale: 'ko', name: '한국어' },
  { locale: 'zh-Hans', name: '简体中文' },
] as const satisfies readonly { locale: Locale; name: string }[];

export const SUPPORTED_LOCALES: readonly Locale[] = LANGUAGES.map((l) => l.locale);

// Compile-time check that no Locale is missing from LANGUAGES.
type Missing = Exclude<Locale, (typeof LANGUAGES)[number]['locale']>;
const _allListed: Missing extends never ? true : Missing = true;
void _allListed;

export const DEFAULT_LOCALE: Locale = 'en';

/** Each language appears once, so matching is by the primary subtag. */
const BY_LANGUAGE = new Map<string, Locale>(SUPPORTED_LOCALES.map((l) => [l.split('-')[0]!.toLowerCase(), l]));
// Old Android code for Indonesian.
BY_LANGUAGE.set('in', 'id');

/**
 * The supported locale for a BCP 47 tag, or null. Matches on the language only, so `pt-PT` gets
 * Brazilian Portuguese and `zh-Hant-TW` Simplified Chinese: the closest we have.
 * Keep in step with matchLocale in server/src/i18n/locale.ts.
 */
export function matchLocale(tag: string | null | undefined): Locale | null {
  const language = tag?.trim().split(/[-_]/)[0]?.toLowerCase();
  return (language && BY_LANGUAGE.get(language)) || null;
}

/** The first of the device's preferred languages that we support, else English. */
export function pickLocale(deviceTags: readonly string[]): Locale {
  for (const tag of deviceTags) {
    const match = matchLocale(tag);
    if (match) return match;
  }
  return DEFAULT_LOCALE;
}
