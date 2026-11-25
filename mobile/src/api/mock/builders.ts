import {
  ALL_DIFFICULTIES,
  FREE_DIFFICULTIES,
  MAX_POINTS,
  mockUser,
  others,
  photo,
  userSeed,
  WORD_POOLS,
} from '@/api/mock/fixtures';
import { requireMe, state } from '@/api/mock/state';
import type { Difficulty, FeedItem, FriendStatus, LeaderboardEntry, User, UserProfile } from '@/api/types';

/** Builds API responses from the fake backend's state. */

type MockWord = { id: string; difficulty: Difficulty; word: string };

/** Every word of the day. Pass includeExpert=false to get only the free three. */
export function todaysWords(includeExpert = true): MockWord[] {
  return (includeExpert ? ALL_DIFFICULTIES : FREE_DIFFICULTIES).map((difficulty, i) => {
    const pool = WORD_POOLS[difficulty];
    return {
      id: `${state.dayIndex}-${difficulty}`,
      difficulty,
      word: pool[(state.dayIndex * 7 + i * 3) % pool.length],
    };
  });
}

/** A made-up number of players who found a word, growing through the day. */
export function foundCountFor(difficulty: Difficulty) {
  const hours = (Date.now() - state.dayStart) / 3_600_000;
  const base = { easy: 900, medium: 260, hard: 45, expert: 12 }[difficulty];
  return Math.floor(base * Math.min(1, hours / 12 + 0.1));
}

/**
 * When the first made-up finder got the word: a fixed time after the day started (harder words later), never in
 * the future, and the player's own find if that came earlier. null while nobody has it.
 */
export function firstFoundAtFor(difficulty: Difficulty, foundCount: number, mine: string | null): string | null {
  const minutes = { easy: 20, medium: 45, hard: 90, expert: 150 }[difficulty];
  const fake = foundCount > 0 ? Math.min(Date.now(), state.dayStart + minutes * 60_000) : null;
  const own = mine ? new Date(mine).getTime() : null;
  const first = fake === null ? own : own === null ? fake : Math.min(fake, own);
  return first === null ? null : new Date(first).toISOString();
}

export function myValidSubmission(wordId: string) {
  return state.mySubmissions.find((s) => s.wordId === wordId && s.status === 'valid') ?? null;
}

export function myPendingSubmission(wordId: string) {
  return state.mySubmissions.find((s) => s.wordId === wordId && s.status === 'pending') ?? null;
}

function feedItem(
  user: User,
  word: MockWord,
  find: Pick<FeedItem, 'submissionId' | 'points' | 'rank' | 'imageUrl' | 'createdAt'>,
): FeedItem {
  return { user, word: word.word, difficulty: word.difficulty, ...find };
}

/** A fake player's finds today (about two out of three words). */
export function feedFor(u: User): FeedItem[] {
  return todaysWords(u.isPremium)
    .filter((_, i) => (userSeed(u) + i + state.dayIndex) % 3 !== 0)
    .map((w, i) =>
      feedItem(u, w, {
        submissionId: `${u.id}-${w.id}`,
        points: Math.round(MAX_POINTS[w.difficulty] * (0.5 + 0.1 * i)),
        rank: 10 + i * 17 + userSeed(u),
        imageUrl: photo(`${u.id}-${w.id}`),
        createdAt: new Date(state.dayStart + (i + 1) * 3_600_000).toISOString(),
      }),
    );
}

/** The signed-in player's valid finds today. */
function myFeed(self: User): FeedItem[] {
  return state.mySubmissions
    .filter((s) => s.status === 'valid')
    .map((s) =>
      feedItem(self, todaysWords().find((w) => w.id === s.wordId)!, {
        submissionId: s.id,
        points: s.points,
        rank: s.rank,
        imageUrl: s.imageUrl ?? '',
        createdAt: s.createdAt,
      }),
    );
}

export function friendStatus(userId: string): FriendStatus {
  if (state.blocked.has(userId)) return 'blocked';
  if (state.friends.has(userId)) return 'friends';
  if (state.outgoing.has(userId)) return 'outgoing';
  if (state.incoming.some((r) => r.from.id === userId)) return 'incoming';
  return 'none';
}

export function leaderboardEntries(scope: 'global' | 'friends'): LeaderboardEntry[] {
  const self = requireMe();
  const pool: { user: User; points: number }[] = [];
  if (scope === 'global') {
    for (let i = 0; i < 60; i++) {
      pool.push({ user: mockUser(`g${i}`, `hunter${i + 1}`), points: Math.max(0, 9000 - i * 140 - (i % 7) * 13) });
    }
  }
  for (const o of others) {
    if (scope === 'friends' && !state.friends.has(o.id)) continue;
    pool.push({ user: o, points: 1500 + userSeed(o) * 377 });
  }
  if (state.monthPoints > 0 || scope === 'friends') pool.push({ user: self, points: state.monthPoints });
  return pool
    .filter((p) => !state.blocked.has(p.user.id))
    .sort((a, b) => b.points - a.points)
    .map((p, i) => ({ ...p, rank: i + 1 }));
}

export function profileFor(u: User, isSelf: boolean): UserProfile {
  const status = isSelf ? 'friends' : friendStatus(u.id);
  const entry = leaderboardEntries('global').find((e) => e.user.id === u.id) ?? null;
  const reqId = state.outgoing.get(u.id) ?? state.incoming.find((r) => r.from.id === u.id)?.id ?? null;
  return {
    user: u,
    friendStatus: status,
    requestId: reqId,
    monthPoints: entry?.points ?? 0,
    monthRank: entry?.rank ?? null,
    streak: isSelf ? (state.totalFinds > 0 ? 1 : 0) : 3 + userSeed(u),
    totalFinds: isSelf ? state.totalFinds : 20 + userSeed(u) * 4,
    today: isSelf ? myFeed(u) : status === 'friends' ? feedFor(u) : [],
  };
}
