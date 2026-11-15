// Shapes of the server's /admin/* responses, straight from the server (server/src/dto/admin.ts),
// so the panel and the API can't drift apart. Type-only imports: nothing from the server is bundled.

import type { Difficulty } from '@shared/types';

export type { Difficulty };
export type {
  AdminReport as Report,
  AdminWord,
  EvalReport,
  EvalWord,
  ModelStatus,
  MonthSchedule,
  ScheduleDay,
  ScheduledWord,
  WordDayStats,
} from '@server/dto/admin';

/** Same order as the server's `difficulties` (easiest first). */
export const DIFFICULTIES = ['easy', 'medium', 'hard', 'expert'] as const satisfies readonly Difficulty[];

/** Player-facing names (docs/api-contract.md). */
export const LEVEL: Record<Difficulty, string> = {
  easy: 'Rookie',
  medium: 'Scout',
  hard: 'Ranger',
  expert: 'Premium',
};
