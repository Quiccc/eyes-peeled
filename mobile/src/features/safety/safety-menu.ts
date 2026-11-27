import { Alert } from 'react-native';

import { api } from '@/api/endpoints';
import type { ReportReason, User } from '@/api/types';
import { t } from '@/i18n';
import { displayName, errorMessage } from '@/lib/format';

/** Ask before unblocking; `onConfirm` does the unblock (e.g. a useUnblockUser() mutation). */
export function confirmUnblock(user: User, onConfirm: () => void) {
  Alert.alert(t('safety.unblockTitle', { name: displayName(user) }), t('safety.unblockBody'), [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('blocked.unblock'), onPress: onConfirm },
  ]);
}

/** Ask why, then report the user (or one of their photos). */
export function startReport(user: User, submissionId?: string) {
  const report = (reason: ReportReason) =>
    api
      .report({ submissionId, userId: user.id, reason })
      .then(() => Alert.alert(t('safety.reportThanksTitle'), t('safety.reportThanksBody')))
      .catch((e) => Alert.alert(t('safety.reportFailed'), errorMessage(e)));

  // Android alerts show at most 3 buttons — keep each menu to 3.
  Alert.alert(t('safety.reportWhy'), undefined, [
    { text: t('safety.reasonInappropriate'), onPress: () => report('inappropriate') },
    { text: t('safety.reasonCheating'), onPress: () => report('cheating') },
    { text: t('common.cancel'), style: 'cancel' },
  ]);
}

/** Ask before blocking, then block; `onBlocked` lets the caller refresh lists. */
export function startBlock(user: User, onBlocked?: () => void) {
  Alert.alert(t('safety.blockTitle', { name: displayName(user) }), t('safety.blockBody'), [
    { text: t('common.cancel'), style: 'cancel' },
    {
      text: t('safety.block'),
      style: 'destructive',
      onPress: () =>
        api
          .blockUser(user.id)
          .then(() => onBlocked?.())
          .catch((e) => Alert.alert(t('safety.blockFailed'), errorMessage(e))),
    },
  ]);
}

/** Ask before unblocking, then unblock; `onUnblocked` lets the caller refresh lists. */
export function startUnblock(user: User, onUnblocked?: () => void) {
  confirmUnblock(user, () =>
    api
      .unblockUser(user.id)
      .then(() => onUnblocked?.())
      .catch((e) => Alert.alert(t('safety.unblockFailed'), errorMessage(e))),
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
    { text: submissionId ? t('safety.reportPhoto') : t('safety.reportUser'), onPress: () => startReport(user, submissionId) },
    blocked
      ? { text: t('safety.unblockUser'), onPress: () => startUnblock(user, onUnblocked) }
      : { text: t('safety.blockUser'), style: 'destructive', onPress: () => startBlock(user, onBlocked) },
    { text: t('common.cancel'), style: 'cancel' },
  ]);
}
