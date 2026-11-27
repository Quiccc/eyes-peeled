import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import type { Locale } from '@/api/types';

import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import hi from './locales/hi.json';
import id from './locales/id.json';
import it from './locales/it.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import ptBR from './locales/pt-BR.json';
import ru from './locales/ru.json';
import tr from './locales/tr.json';
import zhHans from './locales/zh-Hans.json';

/** A catalog's nested strings. */
export type Catalog = { [key: string]: string | Catalog };

/**
 * Every string the app shows, by language. en.json is the source: the others have the same keys, except
 * that each has the plural forms its own language uses (`_one`, `_few`, `_many`, `_other`, and
 * `_ordinal_*` for ranks), so they're typed loosely here and checked by src/i18n/__tests__/catalogs.test.ts.
 */
export const CATALOGS: Record<Locale, Catalog> = {
  en,
  es,
  'pt-BR': ptBR,
  fr,
  de,
  it,
  tr,
  ru,
  id,
  hi,
  ja,
  ko,
  'zh-Hans': zhHans,
};

declare module 'i18next' {
  interface CustomTypeOptions {
    resources: { translation: typeof en };
  }
}

/** The app's one i18next instance; react-i18next's hooks use it through initReactI18next. */
const i18n = createInstance();

void i18n.use(initReactI18next).init({
  resources: Object.fromEntries(Object.entries(CATALOGS).map(([l, c]) => [l, { translation: c }])),
  lng: 'en',
  fallbackLng: 'en',
  // Locale tags are used as given ("pt-BR", "zh-Hans"), never split into a language-only fallback.
  load: 'currentOnly',
  interpolation: { escapeValue: false },
  returnNull: false,
  // Resources are bundled, so init is synchronous and the first render is already translated.
  initAsync: false,
});

export { i18n };

/** Translate outside React (API client, alerts built in plain functions). Components use useTranslation(). */
export const t = i18n.t.bind(i18n) as unknown as typeof i18n.t;

/** The language the app is showing right now. */
export function currentLocale(): Locale {
  return (i18n.language as Locale | undefined) ?? 'en';
}
