import { StyleSheet, View } from 'react-native';

import type { User } from '@/api/types';
import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { displayName, joinedLabel } from '@/lib/format';

/**
 * Big avatar, name and join month at the top of a profile.
 * `ring`: true for the signed-in user's own profile (orange), 'hue' for another hunter's (their color).
 */
export function ProfileHeader({ user, ring }: { user: User; ring?: boolean | 'hue' }) {
  return (
    <View style={styles.identity}>
      <Avatar user={user} size={72} ring={ring} />
      <View style={styles.text}>
        <ThemedText type="title" style={styles.name} numberOfLines={1} adjustsFontSizeToFit accessibilityRole="header">
          {displayName(user)}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {joinedLabel(user.joinedAt)}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  name: {
    lineHeight: 36,
  },
});
