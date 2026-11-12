import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/api/endpoints';
import type { LeaderboardScope } from '@/api/types';
import { useAuth } from '@/auth/auth-provider';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UserRow } from '@/components/user-row';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { daysUntil, errorMessage } from '@/lib/format';
import { queryKeys } from '@/lib/query-client';

export default function LeaderboardScreen() {
  const theme = useTheme();
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

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView edges={['top']} style={styles.flex}>
        <View style={styles.header}>
          <ThemedText type="subtitle">Leaderboard</ThemedText>
          {first && (
            <ThemedText type="small" themeColor="textSecondary">
              {new Date(`${first.month}-01T00:00:00Z`).toLocaleDateString(undefined, {
                month: 'long',
                year: 'numeric',
                timeZone: 'UTC',
              })}{' '}
              · resets in {daysUntil(first.resetsAt)} days
            </ThemedText>
          )}
          <View style={[styles.segment, { backgroundColor: theme.backgroundElement }]}>
            {(['global', 'friends'] as const).map((s) => (
              <Pressable
                key={s}
                onPress={() => setScope(s)}
                style={[styles.segmentItem, scope === s && { backgroundColor: theme.background }]}>
                <ThemedText type="smallBold" themeColor={scope === s ? 'text' : 'textSecondary'}>
                  {s === 'global' ? 'Global' : 'Friends'}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        {query.isPending ? (
          <ActivityIndicator style={styles.loader} />
        ) : query.error ? (
          <ThemedText themeColor="textSecondary" style={styles.empty}>
            {errorMessage(query.error)}
          </ThemedText>
        ) : (
          <FlatList
            data={entries}
            keyExtractor={(e) => e.user.id}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />}
            onEndReached={() => query.hasNextPage && !query.isFetchingNextPage && query.fetchNextPage()}
            onEndReachedThreshold={0.5}
            ListEmptyComponent={
              <ThemedText themeColor="textSecondary" style={styles.empty}>
                {scope === 'friends' ? 'Add friends to compete with them.' : 'No points yet this month. Be the first!'}
              </ThemedText>
            }
            ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator /> : undefined}
            renderItem={({ item }) => (
              <UserRow
                user={item.user}
                rank={item.rank}
                highlight={item.user.id === user?.id}
                noLink={item.user.id === user?.id}
                right={<ThemedText type="smallBold">{item.points.toLocaleString()}</ThemedText>}
              />
            )}
          />
        )}

        {me && !meVisible && (
          <View style={[styles.mePinned, { borderTopColor: theme.border, backgroundColor: theme.background }]}>
            <UserRow
              user={me.user}
              rank={me.rank}
              highlight
              noLink
              right={<ThemedText type="smallBold">{me.points.toLocaleString()}</ThemedText>}
            />
          </View>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
    marginTop: Spacing.two,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: 10,
  },
  list: {
    paddingHorizontal: Spacing.two,
    paddingBottom: BottomTabInset + Spacing.six,
  },
  loader: {
    marginTop: Spacing.six,
  },
  empty: {
    textAlign: 'center',
    marginTop: Spacing.five,
    paddingHorizontal: Spacing.four,
  },
  mePinned: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: BottomTabInset,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
