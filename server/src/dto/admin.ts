import type { Difficulty, Locale } from '@shared/types';

/** What players see for a word in each language other than English. Missing = the English label. */
export type WordTranslations = Partial<Record<Exclude<Locale, 'en'>, string>>;

/**
 * Response shapes of the /admin/* API. The admin panel (server/admin) imports these as types, so
 * the server and the panel can't drift apart. Types only: no runtime imports here.
 */

export type ScheduledWord = { dailyWordId: string; wordId: string; label: string };
export type ScheduleDay = { date: string; words: Record<Difficulty, ScheduledWord | null> };
export type MonthSchedule = { month: string; today: string; days: ScheduleDay[] };

export type AdminWord = {
  id: string;
  label: string;
  difficulty: Difficulty;
  enabled: boolean;
  minConfidence: number | null;
  translations: WordTranslations;
  lastUsed: string | null;
  nextUse: string | null;
};

export type AdminReport = {
  id: string;
  reporterId: string | null;
  submissionId: string | null;
  userId: string | null;
  reason: 'inappropriate' | 'spam' | 'cheating' | 'other';
  status: 'open' | 'resolved';
  createdAt: string;
  submission: { id: string; userId: string; status: string; imageUrl: string | null } | null;
  /** The reported user: named directly, or the owner of the reported photo. */
  /** `avatarUrl`: the player's profile picture, if they uploaded one. */
  target: { id: string; username: string | null; bannedAt: string | null; avatarUrl: string | null } | null;
};

/** POST /admin/words/translate: how many words got translations, and which failed. */
export type TranslateResult = { translated: number; failed: string[] };

export type WordDayStats = {
  date: string;
  difficulty: Difficulty;
  label: string;
  attempts: number;
  valid: number;
  invalid: number;
  /** valid / (valid + invalid); null with no decided attempts */
  passRate: number | null;
  finders: number;
  /** Average confidence of rejected photos that had one: close to the threshold = maybe too strict */
  avgInvalidConfidence: number | null;
};
