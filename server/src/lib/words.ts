import type { Locale } from '@shared/types';

import type { WordTranslations } from '../db/schema';
import { currentLocale } from '../i18n/locale';

/**
 * The word as players see it: its translation in `locale` (the current request's by default), or the
 * English label when there is none. Claude always gets the English label.
 */
export function wordName(word: { label: string; translations: WordTranslations }, locale: Locale = currentLocale()) {
  return (locale !== 'en' && word.translations[locale]?.trim()) || word.label;
}
