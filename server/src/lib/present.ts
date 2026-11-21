import type { Difficulty, FeedItem, Submission, User } from '@shared/types';

import type { SubmissionRow, UserRow } from '../db/schema';
import type { Storage } from '../services/storage';

/** DB rows -> the shapes in mobile/src/api/types.ts. */

export const toUser = (u: UserRow, storage: Storage): User => ({
  id: u.id,
  username: u.username,
  displayName: u.displayName,
  avatarUrl: u.avatarKey ? storage.avatarUrl(u.avatarKey) : null,
  isPremium: u.isPremium,
  joinedAt: u.createdAt.toISOString(),
});

export function toSubmission(s: SubmissionRow, storage: Storage): Submission {
  const valid = s.status === 'valid';
  return {
    id: s.id,
    wordId: s.dailyWordId,
    // 'removed' (by moderation) and 'error' (verifier unreachable) look invalid to the player
    status: s.status === 'removed' || s.status === 'error' ? 'invalid' : s.status,
    points: valid ? s.points : 0,
    comboPoints: valid ? s.comboPoints : 0,
    rank: valid ? s.rank : null,
    confidence: s.confidence,
    message: s.status === 'removed' ? 'This photo was removed by a moderator.' : s.message,
    imageUrl: s.imageKey ? storage.signedUrl(s.imageKey) : null,
    createdAt: s.receivedAt.toISOString(),
  };
}

export function toFeedItem(
  s: Pick<SubmissionRow, 'id' | 'points' | 'rank' | 'imageKey' | 'receivedAt'>,
  user: UserRow,
  word: { label: string; difficulty: Difficulty },
  storage: Storage,
): FeedItem {
  return {
    submissionId: s.id,
    user: toUser(user, storage),
    word: word.label,
    difficulty: word.difficulty,
    points: s.points,
    rank: s.rank,
    // Feed items are valid finds; only duplicates (always invalid) have no stored photo.
    imageUrl: storage.signedUrl(s.imageKey!),
    createdAt: s.receivedAt.toISOString(),
  };
}
