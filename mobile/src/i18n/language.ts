import { getLocales } from 'expo-localization';
import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import type { Locale } from '@/api/types';
import { queryClient } from '@/lib/query-client';

import { i18n } from './index';
import { pickLocale, SUPPORTED_LOCALES } from './languages';

/**
 * The player's language choice from Profile → Language: 'system' follows the phone (the first of its
 * languages we support, else English), or one of our languages.
 *
 * Changing it switches every screen at once (react-i18next re-renders the components that use
 * useTranslation) and refetches server data, so words and messages come back in the new language.
 */
export type LanguagePref = 'system' | Locale;

const KEY = 'settings.language';

let pref: LanguagePref = 'system';
const listeners = new Set<() => void>();

function deviceLocale(): Locale {
  return pickLocale(getLocales().map((l) => l.languageTag));
}

function resolve(p: LanguagePref): Locale {
  return p === 'system' ? deviceLocale() : p;
}

function apply(next: LanguagePref) {
  pref = next;
  const locale = resolve(next);
  if (locale !== i18n.language) {
    // Words, verdicts and server messages are translated by the server (Accept-Language), so refetch
    // once the switch is done: requests made earlier would still ask for the old language.
    void i18n.changeLanguage(locale).then(() => queryClient.invalidateQueries());
  }
  listeners.forEach((l) => l());
}

// Show the phone's language from the very first frame; a saved choice is applied by loadLanguage().
apply('system');

// Android keeps the app running when the phone's language changes (iOS restarts it).
AppState.addEventListener('change', (state) => {
  if (state === 'active' && pref === 'system') apply('system');
});

/** Read the saved choice and apply it. Call once at startup. Never throws. */
export async function loadLanguage(): Promise<void> {
  try {
    const saved = await SecureStore.getItemAsync(KEY);
    if (saved && (saved === 'system' || SUPPORTED_LOCALES.includes(saved as Locale))) apply(saved as LanguagePref);
  } catch {
    // Unreadable storage: keep following the phone.
  }
}

/** Switch language and remember the choice. Never throws. */
export async function setLanguage(next: LanguagePref): Promise<void> {
  if (next === pref) return;
  apply(next);
  try {
    await SecureStore.setItemAsync(KEY, next);
  } catch (e) {
    console.warn('Could not save language', e);
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The current choice ('system' or a locale), not the resolved language: use currentLocale() for that. */
export function useLanguagePref(): LanguagePref {
  return useSyncExternalStore(subscribe, () => pref);
}
