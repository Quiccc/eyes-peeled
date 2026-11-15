import { Alert } from 'react-native';

import { api } from '@/api/endpoints';
import type { ReportReason, User } from '@/api/types';
import { displayName, errorMessage } from '@/lib/format';

/**
 * Report / block actions required by App Store guideline 1.2 (user-generated content).
 * `onBlocked` lets the caller refresh lists so the blocked user's content disappears immediately.
 */
export function openSafetyMenu({
  user,
  submissionId,
  onBlocked,
}: {
  user: User;
  submissionId?: string;
  onBlocked?: () => void;
}) {
  const report = (reason: ReportReason) =>
    api
      .report({ submissionId, userId: user.id, reason })
      .then(() => Alert.alert('Thanks for letting us know', 'Our team will review this report.'))
      .catch((e) => Alert.alert('Report failed', errorMessage(e)));

  // Android alerts show at most 3 buttons — keep each menu to 3.
  const askReason = () =>
    Alert.alert('Why are you reporting this?', undefined, [
      { text: 'Inappropriate content', onPress: () => report('inappropriate') },
      { text: 'Not a real find / cheating', onPress: () => report('cheating') },
      { text: 'Cancel', style: 'cancel' },
    ]);

  const block = () =>
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

  Alert.alert(displayName(user), undefined, [
    { text: submissionId ? 'Report photo' : 'Report user', onPress: askReason },
    { text: 'Block user', style: 'destructive', onPress: block },
    { text: 'Cancel', style: 'cancel' },
  ]);
}
