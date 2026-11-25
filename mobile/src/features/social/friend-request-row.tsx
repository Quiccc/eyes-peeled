import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { FriendRequest } from '@/api/types';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Edge, Spacing } from '@/constants/theme';
import { usePressGuard } from '@/hooks/use-press-guard';
import { useTheme } from '@/hooks/use-theme';
import { displayName } from '@/lib/format';

type Respond = {
  /** Which request is waiting for the server, and for which answer. */
  pending: { id: string; action: 'accept' | 'decline' } | null;
  /** Any request is being answered: keep the buttons from firing twice. */
  disabled: boolean;
  onRespond: (id: string, action: 'accept' | 'decline') => void;
};

/**
 * Incoming friend requests as one highlighted card. One request shows its sender with decline (✕) and Accept;
 * several show stacked avatars and a count, with Review opening the individual requests.
 */
export function FriendRequestsCard({ requests, ...respond }: { requests: FriendRequest[] } & Respond) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const card = [styles.card, { backgroundColor: theme.backgroundSelected, borderColor: theme.tint }];

  if (requests.length === 1) {
    return (
      <View style={card}>
        <RequestRow request={requests[0]} subtitle="wants to be friends" {...respond} />
      </View>
    );
  }

  const names = requests.map((r) => r.from.username ?? displayName(r.from));
  const summary = names.length <= 3 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`;

  return (
    <View style={card}>
      <View style={styles.row}>
        <View style={styles.stack} importantForAccessibility="no-hide-descendants">
          {requests.slice(0, 3).map((r, i) => (
            <View
              key={r.id}
              style={[styles.stacked, i > 0 && styles.overlap, { borderColor: theme.backgroundSelected, zIndex: 3 - i }]}>
              <Avatar user={r.from} size={40} />
            </View>
          ))}
        </View>
        <View style={styles.text}>
          <ThemedText style={styles.name} numberOfLines={1}>
            {requests.length} friend requests
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {summary}
          </ThemedText>
        </View>
        <Button
          size="small"
          variant={open ? 'secondary' : 'primary'}
          title={open ? 'Hide' : 'Review'}
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen((o) => !o)}
        />
      </View>
      {open &&
        requests.map((r) => (
          <View key={r.id} style={[styles.expanded, { borderTopColor: theme.scoreDivider }]}>
            <RequestRow request={r} {...respond} />
          </View>
        ))}
    </View>
  );
}

function RequestRow({
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
  card: {
    paddingVertical: Spacing.two + 4,
    paddingLeft: 14,
    paddingRight: Spacing.two + 4,
    borderRadius: 20,
    borderWidth: 2,
    borderBottomWidth: Edge.button,
  },
  row: {
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
  stack: {
    flexDirection: 'row',
    marginRight: Spacing.one,
  },
  stacked: {
    borderRadius: 999,
    borderWidth: 3,
    margin: -3,
  },
  overlap: {
    marginLeft: -17,
  },
  decline: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expanded: {
    marginTop: Spacing.two + 4,
    paddingTop: Spacing.two + 4,
    borderTopWidth: 2,
  },
});
