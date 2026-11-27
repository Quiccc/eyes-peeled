import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import type { FriendRequest } from '@/api/types';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { usePressGuard } from '@/hooks/use-press-guard';
import { useTheme } from '@/hooks/use-theme';
import { displayName } from '@/lib/format';

export type Respond = {
  /** Which request is waiting for the server, and for which answer. */
  pending: { id: string; action: 'accept' | 'decline' } | null;
  /** Any request is being answered: keep the buttons from firing twice. */
  disabled: boolean;
  onRespond: (id: string, action: 'accept' | 'decline') => void;
};

/** One incoming request: the sender (links to their profile), decline (✕) and Accept. */
export function RequestRow({
  request,
  subtitle,
  pending,
  disabled,
  onRespond,
}: { request: FriendRequest; subtitle?: string } & Respond) {
  const theme = useTheme();
  const guard = usePressGuard();
  const from = request.from;
  const name = from.username ?? displayName(from);
  const waiting = pending?.id === request.id ? pending.action : null;
  return (
    <View style={styles.row}>
      <Link href={{ pathname: '/user/[userId]', params: { userId: from.id } }} asChild>
        <Pressable accessibilityRole="link" style={styles.user}>
          <Avatar user={from} size={40} />
          <View style={styles.text}>
            <ThemedText style={styles.name} numberOfLines={1}>
              {name}
            </ThemedText>
            {subtitle ? (
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {subtitle}
              </ThemedText>
            ) : null}
          </View>
        </Pressable>
      </Link>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Decline ${displayName(from)}`}
        accessibilityState={{ busy: waiting === 'decline', disabled }}
        disabled={disabled}
        onPress={guard(() => onRespond(request.id, 'decline'))}
        style={({ pressed }) => [styles.decline, { opacity: disabled ? 0.5 : pressed ? 0.6 : 1 }]}>
        <Icon name="close" size={20} color={theme.textSecondary} />
      </Pressable>
      <Button
        size="small"
        title="Accept"
        accessibilityLabel={`Accept ${displayName(from)}`}
        loading={waiting === 'accept'}
        disabled={disabled}
        onPress={() => onRespond(request.id, 'accept')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  user: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 4,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontWeight: 900,
  },
  decline: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
