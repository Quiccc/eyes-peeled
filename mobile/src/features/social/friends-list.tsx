import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'expo-router';
import type { ReactNode } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { invalidateSocial, useFriendsList } from '@/api/queries';
import type { FriendRequest, User } from '@/api/types';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { EmptyState, SkeletonRows } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { RaceFriendsArt } from '@/components/illustrations/ranks-art';
import { SectionLabel } from '@/components/section-label';
import { ThemedText } from '@/components/themed-text';
import { Edge, Radius, Spacing } from '@/constants/theme';
import { startBlock } from '@/features/safety/safety-menu';
import { RequestRow } from '@/features/social/friend-request-row';
import { useRemoveFriend, useRespondFriendRequest } from '@/features/social/use-friend-mutations';
import { useTheme } from '@/hooks/use-theme';
import { displayName, errorMessage, friendsSinceLabel } from '@/lib/format';

type Props = {
  /** Incoming requests (undefined while loading); the screen loads them too, for the badge on the switch. */
  requests: FriendRequest[] | undefined;
  /** Focus the search field, from the empty state's "Find hunters". */
  onFindHunters: () => void;
};

/** The Friends side of the Friends tab: incoming requests, requests you sent, and your friends. */
export function FriendsList({ requests: incoming, onFindHunters }: Props) {
  const queryClient = useQueryClient();
  const list = useFriendsList();
  const respond = useRespondFriendRequest();
  const remove = useRemoveFriend();

  // Wait for both, so "No friends yet" never flashes before pending requests arrive.
  if (list.isPending || !incoming) return <SkeletonRows count={4} height={64} />;
  const requests = incoming;
  if (list.error) {
    return (
      <EmptyState
        icon="users"
        title="Couldn't load your friends"
        hint={errorMessage(list.error)}
        action={<Button title="Try again" variant="secondary" onPress={() => list.refetch()} />}
      />
    );
  }

  const { friends, sent } = list.data;
  if (!friends.length && !sent.length && !requests.length) {
    return (
      <EmptyState
        art={<RaceFriendsArt />}
        title="No friends yet"
        hint="Search for hunters by username to add them."
        action={<Button title="Find hunters" icon="person-add" onPress={onFindHunters} />}
      />
    );
  }

  const openMenu = (user: User) => {
    const name = displayName(user);
    // Android alerts show at most 3 buttons.
    Alert.alert(name, undefined, [
      {
        text: 'Remove friend',
        onPress: () =>
          Alert.alert(`Remove ${name}?`, "You'll stop seeing each other's finds.", [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: () => remove.mutate(user.id) },
          ]),
      },
      { text: `Block ${name}`, style: 'destructive', onPress: () => startBlock(user, () => invalidateSocial(queryClient)) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View style={styles.root}>
      {requests.length > 0 && (
        <Section label={`REQUESTS · ${requests.length}`} highlight>
          {requests.map((r, i) => (
            <Row key={r.id} first={i === 0} highlight>
              <RequestRow
                request={r}
                subtitle="wants to be friends"
                pending={respond.isPending && respond.variables ? respond.variables : null}
                disabled={respond.isPending}
                onRespond={(id, action) => respond.mutate({ id, action })}
              />
            </Row>
          ))}
        </Section>
      )}

      {sent.length > 0 && (
        <Section label={`SENT · ${sent.length}`}>
          {sent.map((s, i) => (
            <Row key={s.id} first={i === 0}>
              <UserLink user={s.to} subtitle="Request sent" />
              <Button
                size="small"
                variant="secondary"
                title="Cancel"
                accessibilityLabel={`Cancel request to ${displayName(s.to)}`}
                loading={remove.isPending && remove.variables === s.to.id}
                onPress={() => remove.mutate(s.to.id)}
              />
            </Row>
          ))}
        </Section>
      )}

      {friends.length > 0 && (
        <Section label={`YOUR FRIENDS · ${friends.length}`}>
          {friends.map((f, i) => (
            <Row key={f.user.id} first={i === 0}>
              <UserLink user={f.user} subtitle={friendsSinceLabel(f.since)} />
              <MoreButton user={f.user} onPress={() => openMenu(f.user)} />
            </Row>
          ))}
        </Section>
      )}
    </View>
  );
}

/** A section label over one grouped card; requests get the highlighted (orange) card. */
function Section({ label, highlight, children }: { label: string; highlight?: boolean; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <SectionLabel>{label}</SectionLabel>
      <View
        style={[
          styles.group,
          highlight
            ? { backgroundColor: theme.backgroundSelected, borderColor: theme.tint }
            : { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        ]}>
        {children}
      </View>
    </View>
  );
}

function Row({ first, highlight, children }: { first: boolean; highlight?: boolean; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      {!first && <View style={[styles.divider, { backgroundColor: highlight ? theme.scoreDivider : theme.border }]} />}
      {children}
    </View>
  );
}

function UserLink({ user, subtitle }: { user: User; subtitle: string }) {
  return (
    <Link href={{ pathname: '/user/[userId]', params: { userId: user.id } }} asChild>
      <Pressable accessibilityRole="link" style={styles.user}>
        <Avatar user={user} size={40} />
        <View style={styles.text}>
          <ThemedText style={styles.name} numberOfLines={1}>
            {displayName(user)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {subtitle}
          </ThemedText>
        </View>
      </Pressable>
    </Link>
  );
}

function MoreButton({ user, onPress }: { user: User; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Options for ${displayName(user)}`}
      onPress={onPress}
      style={({ pressed }) => [styles.more, { opacity: pressed ? 0.6 : 1 }]}>
      <Icon name="more" size={22} color={theme.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.three,
  },
  section: {
    gap: Spacing.two,
  },
  group: {
    borderRadius: Radius.lg,
    borderWidth: 2,
    borderBottomWidth: Edge.card,
    overflow: 'hidden',
  },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingLeft: 14,
    paddingRight: 10,
  },
  divider: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
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
  more: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
