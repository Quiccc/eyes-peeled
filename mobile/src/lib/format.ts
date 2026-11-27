import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { Difficulty, Locale } from '@/api/types';
import { currentLocale, t as globalT } from '@/i18n';

/**
 * Text helpers, bound to one language.
 *
 * Components get them from useFormat(): the object changes when the language does, so the React Compiler
 * re-runs `fmt.timeAgo(…)` and friends after a switch. (A plain function that reads the global language
 * looks pure to the compiler, which would keep showing its first result.) Code outside render, such as
 * event handlers and alerts, can use formatter() for the current language.
 */
export function formatter(t: typeof globalT = globalT, locale: Locale = currentLocale()) {
  /** "November", with the year when it isn't this year: "March 2025". */
  const sinceMonth = (iso: string) => {
    const d = new Date(iso);
    const sameYear = d.getFullYear() === new Date().getFullYear();
    return d.toLocaleDateString(locale, sameYear ? { month: 'long' } : { month: 'long', year: 'numeric' });
  };

  return {
    t,
    locale,
    /** What players see. The keys stay `easy/medium/hard/expert` because they're the API contract. */
    difficultyLabel: (d: Difficulty) => t(`difficulty.${d}`),
    timeAgo(iso: string) {
      const diff = Math.max(0, Date.now() - new Date(iso).getTime());
      const min = Math.floor(diff / 60_000);
      if (min < 1) return t('time.justNow');
      if (min < 60) return t('time.minutesAgo', { count: min });
      const h = Math.floor(min / 60);
      if (h < 24) return t('time.hoursAgo', { count: h });
      return t('time.daysAgo', { count: Math.floor(h / 24) });
    },
    /** 1 -> "1st" in English, "1." in German, "1位" in Japanese. */
    ordinal: (n: number) => t('format.rank', { count: n, ordinal: true }),
    /** 1234 -> "1,234" in the app's language. */
    formatNumber: (n: number) => n.toLocaleString(locale),
    /** Words are shown in capitals everywhere: cards, camera badge, share card. Turkish i -> İ. */
    displayWord(word: string) {
      try {
        return word.toLocaleUpperCase(locale);
      } catch {
        return word.toUpperCase();
      }
    },
    /** "June" for "2026-06" (leaderboard month, always UTC). */
    monthName: (month: string) =>
      new Date(`${month}-01T00:00:00Z`).toLocaleDateString(locale, { month: 'long', timeZone: 'UTC' }),
    /** How a player is named in lists and headers: their username, bare (no "@"). */
    displayName: (u: { username: string | null; displayName: string | null }) =>
      u.username ?? u.displayName ?? t('common.player'),
    /** "Hunting since November", with the year when it isn't this year. */
    joinedLabel: (iso: string) => t('profile.huntingSince', { date: sinceMonth(iso) }),
    /** "Friends since November", with the year when it isn't this year. */
    friendsSinceLabel: (iso: string) => t('friends.friendsSince', { date: sinceMonth(iso) }),
    /** "09:42" (or "9:42 AM"), in the player's local time and clock style. */
    clockTime: (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
    errorMessage: (e: unknown) => (e instanceof Error ? e.message : t('errors.generic')),
  };
}

export type Format = ReturnType<typeof formatter>;

/** The text helpers in the app's current language; re-renders the component when the language changes. */
export function useFormat(): Format {
  const { t, i18n } = useTranslation();
  const locale = i18n.language as Locale;
  return useMemo(() => formatter(t as unknown as typeof globalT, locale), [t, locale]);
}

// Outside render (event handlers, alerts, tests): the current language at call time.
export const difficultyLabel = (d: Difficulty) => formatter().difficultyLabel(d);
export const timeAgo = (iso: string) => formatter().timeAgo(iso);
export const ordinal = (n: number) => formatter().ordinal(n);
export const formatNumber = (n: number) => formatter().formatNumber(n);
export const displayWord = (word: string) => formatter().displayWord(word);
export const monthName = (month: string) => formatter().monthName(month);
export const displayName = (u: { username: string | null; displayName: string | null }) => formatter().displayName(u);
export const joinedLabel = (iso: string) => formatter().joinedLabel(iso);
export const friendsSinceLabel = (iso: string) => formatter().friendsSinceLabel(iso);
export const errorMessage = (e: unknown) => formatter().errorMessage(e);

/** 3725s -> "01:02:05" */
export function formatCountdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

export function daysUntil(iso: string) {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

/** Lowercase letters, digits and underscores, 3–20 long. Same rule as the server. */
export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
