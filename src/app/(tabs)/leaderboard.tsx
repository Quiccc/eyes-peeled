import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/api/endpoints';
import type { LeaderboardScope } from '@/api/types';
import { useAuth } from '@/auth/auth-provider';
import { EmptyState, SkeletonRows } from '@/components/empty-state';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UserRow } from '@/components/user-row';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { daysUntil, errorMessage } from '@/lib/format';
import { queryKeys } from '@/lib/query-client';

const SCOPES = [
  { value: 'global', label: 'Global' },
  { value: 'friends', label: 'Friends' },
] as const satisfies readonly { value: LeaderboardScope; label: string }[];

export default function LeaderboardScreen() {
  const { user } = useAuth();
  const [scope, setScope] = useState<LeaderboardScope>('global');

  const query = useInfiniteQuery({
    queryKey: queryKeys.leaderboard(scope),
    queryFn: ({ pageParam }) => api.getLeaderboard({ scope, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });

  const first = query.data?.pages[0];
  const entries = query.data?.pages.flatMap((p) => p.entries) ?? [];
  const me = first?.me ?? null;
  const meVisible = me && entries.some((e) => e.user.id === me.user.id);
  const days = first ? daysUntil(first.resetsAt) : 0;

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView edges={['top']} style={styles.flex}>
        <View style={styles.header}>
          <View style={styles.titleBlock}>
            <ThemedText type="title" accessibilityRole="header">
              Leaderboard
            </ThemedText>
            {first && (
              <ThemedText type="small" themeColor="textSecondary">
                {new Date(`${first.month}-01T00:00:00Z`).toLocaleDateString(undefined, {
                  month: 'long',
                  timeZone: 'UTC',
                })}{' '}
                · resets in{' '}
                <ThemedText type="smallBold">
                  {days} {days === 1 ? 'day' : 'days'}
                </ThemedText>
              </ThemedText>
            )}
          </View>
          <SegmentedControl accessibilityLabel="Scope" options={SCOPES} value={scope} onChange={setScope} />
        </View>

        {query.isPending ? (
          <View style={styles.list}>
            <SkeletonRows count={7} />
          </View>
        ) : query.error ? (
          <EmptyState icon="retry" title="Couldn't load the leaderboard" hint={errorMessage(query.error)} />
        ) : (
          <FlatList
            style={styles.flex}
            data={entries}
            keyExtractor={(e) => e.user.id}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />}
            onEndReached={() => query.hasNextPage && !query.isFetchingNextPage && query.fetchNextPage()}
            onEndReachedThreshold={0.5}
            ListEmptyComponent={
              scope === 'friends' ? (
                <EmptyState icon="users" title="No friends here yet" hint="Add friends to compete with them." />
              ) : (
                <EmptyState icon="trophy" title="No points yet this month" hint="Be the first on the board!" />
              )
            }
            ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator /> : undefined}
            renderItem={({ item }) => {
              const mine = item.user.id === user?.id;
              return (
                <UserRow
                  user={item.user}
                  rank={item.rank}
                  highlight={mine}
                  noLink={mine}
                  right={<Points value={item.points} />}
                />
              );
            }}
          />
        )}

        {me && !meVisible && (
          <View style={styles.mePinned}>
            <UserRow user={me.user} rank={me.rank} label="You" highlight noLink right={<Points value={me.points} />} />
          </View>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function Points({ value }: { value: number }) {
  return <ThemedText style={styles.points}>{value.toLocaleString()}</ThemedText>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.three,
    gap: Spacing.three,
  },
  titleBlock: {
    gap: Spacing.one,
  },
  list: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.two,
    gap: Spacing.two,
  },
  mePinned: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },
  points: {
    fontWeight: 900,
    fontVariant: ['tabular-nums'],
  },
});
