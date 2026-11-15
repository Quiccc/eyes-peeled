// Shapes of the server's /admin/* responses (server/src/routes/admin.ts and services/).

export const DIFFICULTIES = ['easy', 'medium', 'hard', 'expert'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/** Player-facing names (docs/api-contract.md). */
export const LEVEL: Record<Difficulty, string> = {
  easy: 'Rookie',
  medium: 'Scout',
  hard: 'Ranger',
  expert: 'Premium',
};

export type ScheduledWord = { dailyWordId: string; wordId: string; label: string };
export type ScheduleDay = { date: string; words: Record<Difficulty, ScheduledWord | null> };
export type MonthSchedule = { month: string; today: string; days: ScheduleDay[] };

export type AdminWord = {
  id: string;
  label: string;
  difficulty: Difficulty;
  enabled: boolean;
  minConfidence: number | null;
  knownByModel: boolean | null;
  lastUsed: string | null;
  nextUse: string | null;
};

export type Report = {
  id: string;
  reporterId: string | null;
  submissionId: string | null;
  userId: string | null;
  reason: 'inappropriate' | 'spam' | 'cheating' | 'other';
  status: 'open' | 'resolved';
  createdAt: string;
  submission: { id: string; userId: string; status: string; imageUrl: string } | null;
  target: { id: string; username: string | null; bannedAt: string | null } | null;
};

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
  health: { ok: boolean; model: string; modelVersion: string; classes: number } | null;
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
  passRate: number | null;
  finders: number;
  avgInvalidConfidence: number | null;
};
