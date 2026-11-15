import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { invalidateSocial, MIN_SEARCH_LENGTH, useFeedToday, useFriendRequests, useUserSearch } from '@/api/queries';
import type { FriendStatus } from '@/api/types';
import { Button } from '@/components/button';
import { EmptyState, SkeletonRows } from '@/components/empty-state';
import { FeedCard } from '@/components/feed-card';
import { SectionLabel } from '@/components/section-label';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UserRow } from '@/components/user-row';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { FriendRequestRow } from '@/features/social/friend-request-row';
import { useRespondFriendRequest, useSendFriendRequest } from '@/features/social/use-friend-mutations';
import { useDebounced } from '@/hooks/use-debounced';
import { errorMessage } from '@/lib/format';

const STATUS_LABEL: Partial<Record<FriendStatus, string>> = {
  friends: 'Friends',
  outgoing: 'Requested',
  blocked: 'Blocked',
};

export default function FriendsScreen() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim(), 300);
  const searching = q.length >= MIN_SEARCH_LENGTH;

  const feed = useFeedToday();
  const requests = useFriendRequests();
  const results = useUserSearch(q);
  const respond = useRespondFriendRequest();
  const add = useSendFriendRequest();

  const statusAction = (userId: string, status: FriendStatus) => {
    const label = STATUS_LABEL[status];
    if (label) {
      return (
        <ThemedText type="smallBold" themeColor="textSecondary">
          {label}
        </ThemedText>
      );
    }
    return (
      <Button
        size="small"
        title={status === 'incoming' ? 'Accept' : 'Add'}
        loading={add.isPending && add.variables === userId}
        onPress={() => add.mutate(userId)}
      />
    );
  };

  const header = (
    <View style={styles.headerBlock}>
      <ThemedText type="title" accessibilityRole="header">
        Friends
      </ThemedText>
      <TextField
        icon="search"
        value={search}
        onChangeText={setSearch}
        placeholder="Find hunters by username"
        accessibilityLabel="Find hunters by username"
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
      />

      {searching ? (
        <View style={styles.section}>
          {results.isPending ? (
            <ActivityIndicator style={styles.inlineLoader} />
          ) : results.data?.length ? (
            results.data.map((r) => (
              <UserRow key={r.user.id} user={r.user} right={statusAction(r.user.id, r.friendStatus)} />
            ))
          ) : (
            <EmptyState icon="search" title="No hunters found" hint={`Nobody goes by "${q}" yet.`} />
          )}
        </View>
      ) : (
        <>
          {!!requests.data?.length && (
            <View style={styles.section}>
              <SectionLabel>REQUESTS · {requests.data.length}</SectionLabel>
              {requests.data.map((r) => (
                <FriendRequestRow
                  key={r.id}
                  request={r}
                  pendingAction={respond.isPending && respond.variables?.id === r.id ? respond.variables.action : null}
                  disabled={respond.isPending}
                  onRespond={(action) => respond.mutate({ id: r.id, action })}
                />
              ))}
            </View>
          )}
          <SectionLabel>FRIENDS&apos; FINDS TODAY</SectionLabel>
        </>
      )}
    </View>
  );

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView edges={['top']} style={styles.flex}>
        <FlatList
          data={searching ? [] : (feed.data ?? [])}
          keyExtractor={(item) => item.submissionId}
          ListHeaderComponent={header}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={feed.isRefetching}
              onRefresh={() => {
                feed.refetch();
                requests.refetch();
              }}
            />
          }
          ListEmptyComponent={
            searching ? undefined : feed.isPending ? (
              <SkeletonRows count={2} height={280} />
            ) : feed.error ? (
              <EmptyState
                icon="retry"
                title="Couldn't load finds"
                hint={errorMessage(feed.error)}
                action={<Button title="Try again" variant="secondary" onPress={() => feed.refetch()} />}
              />
            ) : (
              <EmptyState
                icon="camera"
                title="No finds yet today"
                hint="When friends snap today's words, their photos show up here. Search above to add friends."
              />
            )
          }
          renderItem={({ item }) => <FeedCard item={item} onBlocked={() => invalidateSocial(queryClient)} />}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.two,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  headerBlock: {
    gap: Spacing.three,
    paddingBottom: Spacing.one,
  },
  section: {
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  inlineLoader: {
    marginVertical: Spacing.four,
  },
});
