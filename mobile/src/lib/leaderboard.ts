import type { LeaderboardEntry } from '@/api/types';
import { formatter, type Format } from '@/lib/format';

/**
 * The goal line under the signed-in player's pinned row: how many points they need to pass the hunter
 * one place above them. Uses only the entries loaded so far, so a far-down player gets a general nudge.
 */
export function passGoal(entries: readonly LeaderboardEntry[], me: LeaderboardEntry, fmt: Format = formatter()): string {
  const { t } = fmt;
  if (me.rank <= 1) return t('leaderboard.onTop');
  const above = entries.find((e) => e.rank === me.rank - 1 && e.user.id !== me.user.id);
  if (!above) return t('leaderboard.keepHunting');
  // Passing means getting strictly more points, so a tie still needs one more.
  const gap = Math.max(1, above.points - me.points + 1);
  return t('leaderboard.toPass', { count: gap, points: fmt.formatNumber(gap), name: fmt.displayName(above.user) });
}

/**
 * Nobody else on the board: the friends scope always includes the player, so a player with no friends
 * gets a board of one. True when every loaded entry is the player and there are no more pages.
 */
export function isAlone(entries: readonly LeaderboardEntry[], myId: string | undefined, hasMore: boolean): boolean {
  return !hasMore && entries.every((e) => e.user.id === myId);
}
