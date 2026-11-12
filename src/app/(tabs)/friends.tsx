import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/api/endpoints';
import type { FriendStatus } from '@/api/types';
import { Button } from '@/components/button';
import { FeedCard } from '@/components/feed-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UserRow } from '@/components/user-row';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/format';
import { queryKeys } from '@/lib/query-client';

function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

export default function FriendsScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim(), 300);

  const feed = useQuery({ queryKey: queryKeys.feed, queryFn: api.getFeedToday });
  const requests = useQuery({ queryKey: queryKeys.friendRequests, queryFn: api.getFriendRequests });
  const results = useQuery({
    queryKey: queryKeys.search(q),
    queryFn: () => api.searchUsers(q),
    enabled: q.length >= 2,
  });

  const refreshSocial = () => {
    queryClient.invalidateQueries({ queryKey: ['friends'] });
    queryClient.invalidateQueries({ queryKey: ['users'] });
    queryClient.invalidateQueries({ queryKey: queryKeys.feed });
    queryClient.invalidateQueries({ queryKey: ['leaderboard', 'friends'] });
  };

  const respond = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'accept' | 'decline' }) => api.respondFriendRequest(id, action),
    onSuccess: refreshSocial,
    onError: (e) => Alert.alert('Something went wrong', errorMessage(e)),
  });
  const add = useMutation({
    mutationFn: (userId: string) => api.sendFriendRequest(userId),
    onSuccess: refreshSocial,
    onError: (e) => Alert.alert('Could not send request', errorMessage(e)),
  });

  const statusButton = (userId: string, status: FriendStatus) => {
    if (status === 'friends') return <ThemedText type="small" themeColor="textSecondary">Friends</ThemedText>;
    if (status === 'outgoing') return <ThemedText type="small" themeColor="textSecondary">Requested</ThemedText>;
    if (status === 'blocked') return <ThemedText type="small" themeColor="textSecondary">Blocked</ThemedText>;
    return (
      <Button
        size="small"
        title={status === 'incoming' ? 'Accept' : 'Add'}
        loading={add.isPending && add.variables === userId}
        onPress={() => add.mutate(userId)}
      />
    );
  };

  const searching = q.length >= 2;

  const header = (
    <View style={styles.headerBlock}>
      <ThemedText type="subtitle">Friends</ThemedText>
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search by username"
        placeholderTextColor={theme.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        style={[styles.search, { backgroundColor: theme.backgroundElement, color: theme.text }]}
      />

      {searching ? (
        <View>
          {results.isPending ? (
            <ActivityIndicator style={styles.inlineLoader} />
          ) : results.data?.length ? (
            results.data.map((r) => (
              <UserRow key={r.user.id} user={r.user} right={statusButton(r.user.id, r.friendStatus)} />
            ))
          ) : (
            <ThemedText themeColor="textSecondary" style={styles.muted}>
              No users found.
            </ThemedText>
          )}
        </View>
      ) : (
        <>
          {!!requests.data?.length && (
            <View style={styles.section}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                FRIEND REQUESTS
              </ThemedText>
              {requests.data.map((r) => (
                <UserRow
                  key={r.id}
                  user={r.from}
                  subtitle="wants to be friends"
                  right={
                    <View style={styles.requestActions}>
                      <Button
                        size="small"
                        title="Accept"
                        disabled={respond.isPending}
                        onPress={() => respond.mutate({ id: r.id, action: 'accept' })}
                      />
                      <Button
                        size="small"
                        variant="secondary"
                        title="✕"
                        disabled={respond.isPending}
                        accessibilityLabel="Decline"
                        onPress={() => respond.mutate({ id: r.id, action: 'decline' })}
                      />
                    </View>
                  }
                />
              ))}
            </View>
          )}
          <ThemedText type="smallBold" themeColor="textSecondary">
            TODAY FROM FRIENDS
          </ThemedText>
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
              <ActivityIndicator style={styles.inlineLoader} />
            ) : (
              <ThemedText themeColor="textSecondary" style={styles.muted}>
                {feed.error
                  ? errorMessage(feed.error)
                  : 'No finds from friends yet today. Search above to add friends.'}
              </ThemedText>
            )
          }
          renderItem={({ item }) => <FeedCard item={item} onBlocked={refreshSocial} />}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: {
    padding: Spacing.three,
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  headerBlock: {
    gap: Spacing.three,
    paddingTop: Spacing.two,
  },
  search: {
    fontSize: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 4,
    borderRadius: 12,
  },
  section: {
    gap: Spacing.one,
  },
  requestActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  inlineLoader: {
    marginVertical: Spacing.four,
  },
  muted: {
    textAlign: 'center',
    marginVertical: Spacing.four,
  },
});
