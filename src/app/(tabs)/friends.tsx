import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/api/endpoints';
import type { FriendStatus } from '@/api/types';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { EmptyState, SkeletonRows } from '@/components/empty-state';
import { FeedCard } from '@/components/feed-card';
import { Icon } from '@/components/icon';
import { SectionLabel } from '@/components/section-label';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UserRow } from '@/components/user-row';
import { BottomTabInset, Edge, FontFamily, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { displayName, errorMessage } from '@/lib/format';
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
    if (status === 'friends') return <ThemedText type="smallBold" themeColor="textSecondary">Friends</ThemedText>;
    if (status === 'outgoing') return <ThemedText type="smallBold" themeColor="textSecondary">Requested</ThemedText>;
    if (status === 'blocked') return <ThemedText type="smallBold" themeColor="textSecondary">Blocked</ThemedText>;
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
      <ThemedText type="title" accessibilityRole="header">
        Friends
      </ThemedText>
      <View style={[styles.search, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <Icon name="search" size={20} color={theme.textSecondary} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Find hunters by username"
          placeholderTextColor={theme.textSecondary}
          accessibilityLabel="Find hunters by username"
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          style={[styles.searchInput, { color: theme.text }]}
        />
      </View>

      {searching ? (
        <View style={styles.section}>
          {results.isPending ? (
            <ActivityIndicator style={styles.inlineLoader} />
          ) : results.data?.length ? (
            results.data.map((r) => (
              <UserRow key={r.user.id} user={r.user} right={statusButton(r.user.id, r.friendStatus)} />
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
              {requests.data.map((r) => {
                const pendingAction = respond.isPending && respond.variables?.id === r.id ? respond.variables.action : null;
                return (
                  <View
                    key={r.id}
                    style={[styles.request, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                    <Link href={{ pathname: '/user/[userId]', params: { userId: r.from.id } }} asChild>
                      <Pressable accessibilityRole="link" style={styles.requestUser}>
                        <Avatar user={r.from} size={40} />
                        <ThemedText style={styles.requestName} numberOfLines={1}>
                          {r.from.username ?? displayName(r.from)}
                        </ThemedText>
                      </Pressable>
                    </Link>
                    <Button
                      size="small"
                      variant="ghost"
                      title="Decline"
                      accessibilityLabel={`Decline ${displayName(r.from)}`}
                      loading={pendingAction === 'decline'}
                      disabled={respond.isPending}
                      style={styles.decline}
                      onPress={() => respond.mutate({ id: r.id, action: 'decline' })}
                    />
                    <Button
                      size="small"
                      title="Accept"
                      accessibilityLabel={`Accept ${displayName(r.from)}`}
                      loading={pendingAction === 'accept'}
                      disabled={respond.isPending}
                      onPress={() => respond.mutate({ id: r.id, action: 'accept' })}
                    />
                  </View>
                );
              })}
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
              <EmptyState icon="retry" title="Couldn't load finds" hint={errorMessage(feed.error)} />
            ) : (
              <EmptyState
                icon="camera"
                title="No finds yet today"
                hint="When friends snap today's words, their photos show up here. Search above to add friends."
              />
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
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.two,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  headerBlock: {
    gap: Spacing.three,
    paddingBottom: Spacing.one,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
    height: 48,
    paddingHorizontal: Spacing.three - 2,
    borderRadius: Radius.md,
    borderWidth: 2,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    height: 44,
    fontFamily: FontFamily,
    fontSize: 16,
    fontWeight: 700,
  },
  section: {
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  request: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 4,
    padding: Spacing.two + 4,
    borderRadius: 18,
    borderWidth: 2,
    borderBottomWidth: Edge.small,
  },
  requestUser: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 4,
  },
  requestName: {
    flexShrink: 1,
    fontWeight: 900,
  },
  decline: {
    paddingHorizontal: Spacing.two + 4,
  },
  inlineLoader: {
    marginVertical: Spacing.four,
  },
});
