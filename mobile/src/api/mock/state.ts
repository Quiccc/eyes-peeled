import { ApiError } from '@/api/client';
import { ALL_DIFFICULTIES, others } from '@/api/mock/fixtures';
import type { Difficulty, FriendRequest, Submission, User } from '@/api/types';
import { comboForLinks, linksAmong } from '@/lib/combo';

const DAY_MS = 86_400_000;

/** Seconds per virtual "day" (EXPO_PUBLIC_MOCK_RESET_IN_SECONDS), or 0 for real UTC days. */
const resetEverySec = Number(process.env.EXPO_PUBLIC_MOCK_RESET_IN_SECONDS) || 0;

const firstDay = Math.floor(Date.now() / DAY_MS);

/** Everything the fake backend remembers. Resets when the JS bundle reloads. */
export const state = {
  me: null as User | null,
  friends: new Set(['u1', 'u2', 'u3']),
  blocked: new Set<string>(),
  /** userId -> requestId */
  outgoing: new Map<string, string>(),
  incoming: [{ id: 'r1', from: others[4], createdAt: new Date().toISOString() }] as FriendRequest[],

  // virtual day / reset clock
  dayIndex: firstDay,
  dayStart: firstDay * DAY_MS,
  resetAt: resetEverySec ? Date.now() + resetEverySec * 1000 : (firstDay + 1) * DAY_MS,

  mySubmissions: [] as Submission[],
  monthPoints: 0,
  totalFinds: 0,
  /**
   * Submissions start 'pending' and get their verdict a few seconds later, like the server's async verdict queue.
   * The verdict and points are fixed at upload time (the receipt timestamp decides the score).
   */
  verdicts: new Map<string, { at: number; result: Submission }>(),
};

/** Start a new day once the reset time has passed. */
export function rollDay() {
  if (Date.now() < state.resetAt) return;
  state.dayIndex += 1;
  state.dayStart = Date.now();
  state.resetAt = resetEverySec ? Date.now() + resetEverySec * 1000 : Math.floor(Date.now() / DAY_MS + 1) * DAY_MS;
  state.mySubmissions = [];
}

/** Trail position of a mock word id (`${dayIndex}-${difficulty}`). */
const positionOf = (wordId: string) => ALL_DIFFICULTIES.indexOf(wordId.split('-')[1] as Difficulty);

/** Apply every verdict whose time has come. A valid find is credited with the combo bonus it adds. */
export function settlePending() {
  const now = Date.now();
  const found = state.mySubmissions.filter((s) => s.status === 'valid').map((s) => positionOf(s.wordId));
  state.mySubmissions = state.mySubmissions.map((s) => {
    const v = state.verdicts.get(s.id);
    if (s.status !== 'pending' || !v || now < v.at) return s;
    state.verdicts.delete(s.id);
    if (v.result.status !== 'valid') return v.result;
    const before = comboForLinks(linksAmong(found));
    found.push(positionOf(s.wordId));
    const comboPoints = comboForLinks(linksAmong(found)) - before;
    state.monthPoints += v.result.points + comboPoints;
    state.totalFinds += 1;
    return { ...v.result, comboPoints };
  });
}

export function requireMe(): User {
  if (!state.me) throw new ApiError(401, 'unauthorized', 'Not signed in');
  return state.me;
}

export function resetMe() {
  state.me = null;
  state.mySubmissions = [];
  state.monthPoints = 0;
  state.totalFinds = 0;
}
