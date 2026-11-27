import type { Difficulty, FeedItem, Submission, User } from '@shared/types';

import type { SubmissionRow, UserRow, WordTranslations } from '../db/schema';
import { SUBMISSION_MESSAGES, translate } from '../i18n/messages';
import type { Storage } from '../services/storage';
import { wordName } from './words';

/** DB rows -> the shapes in mobile/src/api/types.ts. */

export const toUser = (u: UserRow, storage: Storage): User => ({
  id: u.id,
  username: u.username,
  displayName: u.displayName,
  avatarUrl: u.avatarKey ? storage.avatarUrl(u.avatarKey) : null,
  isPremium: u.isPremium,
  joinedAt: u.createdAt.toISOString(),
});

/** The word a submission was for, needed to word some verdict messages. */
type WordRef = { label: string; translations: WordTranslations };

/** The verdict message in the request's language. Rows from before message codes have English text only. */
function submissionMessage(s: SubmissionRow, word: WordRef): string | null {
  if (s.status === 'removed') return translate('This photo was removed by a moderator.');
  if (s.messageCode) return translate(SUBMISSION_MESSAGES[s.messageCode], { word: wordName(word) });
  return s.message === null ? null : translate(s.message);
}

export function toSubmission(s: SubmissionRow, word: WordRef, storage: Storage): Submission {
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
    message: submissionMessage(s, word),
    imageUrl: s.imageKey ? storage.signedUrl(s.imageKey) : null,
    createdAt: s.receivedAt.toISOString(),
  };
}

export function toFeedItem(
  s: Pick<SubmissionRow, 'id' | 'points' | 'rank' | 'imageKey' | 'receivedAt'>,
  user: UserRow,
  word: WordRef & { difficulty: Difficulty },
  storage: Storage,
): FeedItem {
  return {
    submissionId: s.id,
    user: toUser(user, storage),
    word: wordName(word),
    difficulty: word.difficulty,
    points: s.points,
    rank: s.rank,
    // Feed items are valid finds; only duplicates (always invalid) have no stored photo.
    imageUrl: storage.signedUrl(s.imageKey!),
    createdAt: s.receivedAt.toISOString(),
  };
}
