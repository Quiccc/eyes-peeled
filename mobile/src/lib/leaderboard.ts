import type { LeaderboardEntry } from '@/api/types';
import { displayName, formatNumber } from '@/lib/format';

/**
 * The goal line under the signed-in player's pinned row: how many points they need to pass the hunter
 * one place above them. Uses only the entries loaded so far, so a far-down player gets a general nudge.
 */
export function passGoal(entries: readonly LeaderboardEntry[], me: LeaderboardEntry): string {
  if (me.rank <= 1) return "You're on top!";
  const above = entries.find((e) => e.rank === me.rank - 1 && e.user.id !== me.user.id);
  if (!above) return 'Keep hunting to climb';
  // Passing means getting strictly more points, so a tie still needs one more.
  const gap = Math.max(1, above.points - me.points + 1);
  return `${formatNumber(gap)} ${gap === 1 ? 'pt' : 'pts'} to pass ${displayName(above.user)}`;
}
