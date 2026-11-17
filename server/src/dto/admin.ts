import type { Difficulty } from '@shared/types';

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
  /** null when no YOLO service is configured, so it can't be checked */
  knownByModel: boolean | null;
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
  target: { id: string; username: string | null; bannedAt: string | null } | null;
};

/** GET /health of the YOLO service. */
export type ModelHealth = { ok: boolean; model: string; modelVersion: string; classes: number };

/** One word in a word-test report (yolo/eval/evaluate.py). */
export type EvalWord = {
  word: string;
  pass: boolean;
  problems: string[];
  positives: number;
  positivePassed: number;
  passRate: number | null;
  negatives: number;
  negativePassed: number;
  falseRate: number | null;
};

/** The latest word-test report (yolo/eval/latest.json). */
export type EvalReport = {
  modelVersion: string;
  model: string;
  createdAt: string;
  minConfidence: number;
  bars: { minPass: number; maxFalse: number };
  comparedWith: string | null;
  words: EvalWord[];
};

export type ModelStatus = {
  configured: boolean;
  threshold: number;
  health: ModelHealth | null;
  report: EvalReport | null;
  unknownWords: string[];
  error: string | null;
};

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
