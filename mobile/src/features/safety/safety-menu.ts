import { Alert } from 'react-native';

import { api } from '@/api/endpoints';
import type { ReportReason, User } from '@/api/types';
import { displayName, errorMessage } from '@/lib/format';

/** Ask before unblocking; `onConfirm` does the unblock (e.g. a useUnblockUser() mutation). */
export function confirmUnblock(user: User, onConfirm: () => void) {
  Alert.alert(`Unblock ${displayName(user)}?`, 'You will see each other again. Your friendship does not come back.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Unblock', onPress: onConfirm },
  ]);
}

/** Ask why, then report the user (or one of their photos). */
export function startReport(user: User, submissionId?: string) {
  const report = (reason: ReportReason) =>
    api
      .report({ submissionId, userId: user.id, reason })
      .then(() => Alert.alert('Thanks for letting us know', 'Our team will review this report.'))
      .catch((e) => Alert.alert('Report failed', errorMessage(e)));

  // Android alerts show at most 3 buttons — keep each menu to 3.
  Alert.alert('Why are you reporting this?', undefined, [
    { text: 'Inappropriate content', onPress: () => report('inappropriate') },
    { text: 'Not a real find / cheating', onPress: () => report('cheating') },
    { text: 'Cancel', style: 'cancel' },
  ]);
}

/** Ask before blocking, then block; `onBlocked` lets the caller refresh lists. */
export function startBlock(user: User, onBlocked?: () => void) {
  Alert.alert(`Block ${displayName(user)}?`, "They won't be able to see your photos and you won't see theirs.", [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Block',
      style: 'destructive',
      onPress: () =>
        api
          .blockUser(user.id)
          .then(() => onBlocked?.())
          .catch((e) => Alert.alert('Block failed', errorMessage(e))),
    },
  ]);
}

/** Ask before unblocking, then unblock; `onUnblocked` lets the caller refresh lists. */
export function startUnblock(user: User, onUnblocked?: () => void) {
  confirmUnblock(user, () =>
    api
      .unblockUser(user.id)
      .then(() => onUnblocked?.())
      .catch((e) => Alert.alert('Could not unblock', errorMessage(e))),
  );
}

/**
 * Report / block actions required by App Store guideline 1.2 (user-generated content).
 * `onBlocked` lets the caller refresh lists so the blocked user's content disappears immediately.
 * For a user already blocked (`blocked`), the menu offers Unblock instead, then calls `onUnblocked`.
 */
export function openSafetyMenu({
  user,
  submissionId,
  blocked,
  onBlocked,
  onUnblocked,
}: {
  user: User;
  submissionId?: string;
  blocked?: boolean;
  onBlocked?: () => void;
  onUnblocked?: () => void;
}) {
  Alert.alert(displayName(user), undefined, [
    { text: submissionId ? 'Report photo' : 'Report user', onPress: () => startReport(user, submissionId) },
    blocked
      ? { text: 'Unblock user', onPress: () => startUnblock(user, onUnblocked) }
      : { text: 'Block user', style: 'destructive', onPress: () => startBlock(user, onBlocked) },
    { text: 'Cancel', style: 'cancel' },
  ]);
}
