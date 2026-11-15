import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import type { FriendRequest } from '@/api/types';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Edge, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { displayName } from '@/lib/format';

type Props = {
  request: FriendRequest;
  /** Which button is waiting for the server, if this row's request is being answered. */
  pendingAction: 'accept' | 'decline' | null;
  /** Any request is being answered: keep the buttons from firing twice. */
  disabled: boolean;
  onRespond: (action: 'accept' | 'decline') => void;
};

/** An incoming friend request: who sent it, with Decline and Accept. */
export function FriendRequestRow({ request, pendingAction, disabled, onRespond }: Props) {
  const theme = useTheme();
  const from = request.from;
  return (
    <View style={[styles.request, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <Link href={{ pathname: '/user/[userId]', params: { userId: from.id } }} asChild>
        <Pressable accessibilityRole="link" style={styles.user}>
          <Avatar user={from} size={40} />
          <ThemedText style={styles.name} numberOfLines={1}>
            {from.username ?? displayName(from)}
          </ThemedText>
        </Pressable>
      </Link>
      <Button
        size="small"
        variant="ghost"
        title="Decline"
        accessibilityLabel={`Decline ${displayName(from)}`}
        loading={pendingAction === 'decline'}
        disabled={disabled}
        style={styles.decline}
        onPress={() => onRespond('decline')}
      />
      <Button
        size="small"
        title="Accept"
        accessibilityLabel={`Accept ${displayName(from)}`}
        loading={pendingAction === 'accept'}
        disabled={disabled}
        onPress={() => onRespond('accept')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  request: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 4,
    padding: Spacing.two + 4,
    borderRadius: 18,
    borderWidth: 2,
    borderBottomWidth: Edge.small,
  },
  user: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 4,
  },
  name: {
    flexShrink: 1,
    fontWeight: 900,
  },
  decline: {
    paddingHorizontal: Spacing.two + 4,
  },
});
