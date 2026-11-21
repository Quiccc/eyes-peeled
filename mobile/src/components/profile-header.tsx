import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import type { User } from '@/api/types';
import { Avatar, hueFor } from '@/components/avatar';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { difficultyColors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { displayName, joinedLabel } from '@/lib/format';

const SIZE = 72;
const CENTERED_SIZE = 96;

/**
 * Big avatar, name and join month at the top of a profile.
 * `ring`: true for the signed-in user's own profile (orange), 'hue' for another hunter's (their color).
 * `onEditAvatar`: makes the avatar a button with a camera badge (the signed-in user's own profile);
 * `avatarBusy` shows a spinner over it while a new picture uploads.
 * `centered`: a bigger avatar on a solid edge in their color, with the name centred below (another hunter's profile).
 */
export function ProfileHeader({
  user,
  ring,
  onEditAvatar,
  avatarBusy,
  centered,
}: {
  user: User;
  ring?: boolean | 'hue';
  onEditAvatar?: () => void;
  avatarBusy?: boolean;
  centered?: boolean;
}) {
  const theme = useTheme();
  if (centered) {
    const edge = difficultyColors(theme, hueFor(user.id)).edge;
    return (
      <View style={styles.centered}>
        <View style={[styles.avatarEdge, { boxShadow: `0 4px 0 ${edge}` }]}>
          <Avatar user={user} size={CENTERED_SIZE} ring={ring} />
        </View>
        <ThemedText
          type="title"
          style={styles.centeredName}
          numberOfLines={1}
          adjustsFontSizeToFit
          accessibilityRole="header">
          {displayName(user)}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {joinedLabel(user.joinedAt)}
        </ThemedText>
      </View>
    );
  }
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
  centered: {
    alignItems: 'center',
  },
  avatarEdge: {
    borderRadius: CENTERED_SIZE / 2,
  },
  centeredName: {
    marginTop: Spacing.two + 4,
    textAlign: 'center',
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
