import type { LeaderboardEntry } from '@/api/types';

import { passGoal } from '../leaderboard';

const entry = (rank: number, username: string, points: number): LeaderboardEntry => ({
  rank,
  points,
  user: { id: username, username, displayName: null, avatarUrl: null, isPremium: false, joinedAt: '2026-01-01T00:00:00Z' },
});

describe('passGoal', () => {
  const board = [entry(1, 'maya', 9120), entry(2, 'lucky', 8847), entry(3, 'snap', 8694)];

  it('cheers the player at the top', () => {
    expect(passGoal(board, board[0])).toBe("You're on top!");
  });

  it('counts the points needed to pass the hunter one place up', () => {
    expect(passGoal(board, entry(3, 'snap', 8694))).toBe('154 pts to pass lucky');
    expect(passGoal(board, entry(4, 'me', 1000))).toBe('7,695 pts to pass snap');
  });

  it('needs one more point to break a tie', () => {
    expect(passGoal([entry(1, 'a', 500)], entry(2, 'me', 500))).toBe('1 pt to pass a');
  });

  it('falls back to a nudge when the hunter above is not loaded', () => {
    expect(passGoal(board, entry(23, 'me', 6410))).toBe('Keep hunting to climb');
  });
});
