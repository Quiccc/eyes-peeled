// Shapes of the server's /admin/* responses, straight from the server (server/src/dto/admin.ts),
// so the panel and the API can't drift apart. Type-only imports: nothing from the server is bundled.

import type { Difficulty, Locale } from '@shared/types';

export type { Difficulty };
export type {
  AdminReport as Report,
  AdminWord,
  MonthSchedule,
  TranslateResult,
  WordDayStats,
  WordTranslations,
} from '@server/dto/admin';

/** The app's languages besides English, in the order the Words page shows them. */
export const LANGUAGES = [
  ['es', 'Spanish'],
  ['pt-BR', 'Portuguese (BR)'],
  ['fr', 'French'],
  ['de', 'German'],
  ['it', 'Italian'],
  ['tr', 'Turkish'],
  ['ru', 'Russian'],
  ['id', 'Indonesian'],
  ['hi', 'Hindi'],
  ['ja', 'Japanese'],
  ['ko', 'Korean'],
  ['zh-Hans', 'Chinese (Simplified)'],
] as const satisfies readonly (readonly [Exclude<Locale, 'en'>, string])[];

/** Same order as the server's `difficulties` (easiest first). */
export const DIFFICULTIES = ['easy', 'medium', 'hard', 'expert'] as const satisfies readonly Difficulty[];

/** Player-facing names (docs/api-contract.md). */
export const LEVEL: Record<Difficulty, string> = {
  easy: 'Rookie',
  medium: 'Scout',
  hard: 'Ranger',
  expert: 'Premium',
};
