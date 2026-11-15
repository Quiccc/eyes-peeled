import { StyleSheet, View } from 'react-native';

import type { User } from '@/api/types';
import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { displayName } from '@/lib/format';

/** Big avatar and name at the top of a profile. `ring` marks the signed-in user's own profile. */
export function ProfileHeader({ user, ring }: { user: User; ring?: boolean }) {
  return (
    <View style={styles.identity}>
      <Avatar user={user} size={72} ring={ring} />
      <ThemedText type="title" style={styles.name} numberOfLines={1} adjustsFontSizeToFit accessibilityRole="header">
        {user.username ?? displayName(user)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  name: {
    flex: 1,
    lineHeight: 36,
  },
});
