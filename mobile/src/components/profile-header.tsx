import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import type { User } from '@/api/types';
import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { displayName, joinedLabel } from '@/lib/format';

const SIZE = 72;

/**
 * Big avatar, name and join month at the top of a profile.
 * `ring`: true for the signed-in user's own profile (orange), 'hue' for another hunter's (their color).
 * `onEditAvatar`: makes the avatar a button with a camera badge (the signed-in user's own profile);
 * `avatarBusy` shows a spinner over it while a new picture uploads.
 */
export function ProfileHeader({
  user,
  ring,
  onEditAvatar,
  avatarBusy,
}: {
  user: User;
  ring?: boolean | 'hue';
  onEditAvatar?: () => void;
  avatarBusy?: boolean;
}) {
  const theme = useTheme();
  const avatar = <Avatar user={user} size={SIZE} ring={ring} />;
  return (
    <View style={styles.identity}>
      {onEditAvatar ? (
        <Pressable
          onPress={onEditAvatar}
          disabled={avatarBusy}
          accessibilityRole="button"
          accessibilityLabel={user.avatarUrl ? 'Change profile picture' : 'Add a profile picture'}
          accessibilityState={{ busy: avatarBusy }}
          hitSlop={8}
          style={({ pressed }) => pressed && styles.pressed}>
          {avatar}
          {avatarBusy && (
            <View style={styles.busy}>
              <ActivityIndicator color="#fff" />
            </View>
          )}
          <View style={[styles.badge, { backgroundColor: theme.tint, borderColor: theme.background }]}>
            <Icon name="camera" size={14} color="#fff" />
          </View>
        </Pressable>
      ) : (
        avatar
      )}
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
  pressed: {
    opacity: 0.7,
  },
  busy: {
    ...StyleSheet.absoluteFill,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
