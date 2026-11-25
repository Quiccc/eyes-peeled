import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/api/endpoints';
import type { LeaderboardEntry, LeaderboardScope } from '@/api/types';
import { useAuth } from '@/auth/auth-provider';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { FreshMonthArt, RaceFriendsArt, UnpluggedTrophyArt } from '@/components/illustrations/ranks-art';
import { QueryState } from '@/components/query-state';
import { SegmentedControl } from '@/components/segmented-control';
import { HuntCameraIcon } from '@/components/tab-icons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Edge, Radius, Spacing } from '@/constants/theme';
import { Podium } from '@/features/leaderboard/podium';
import { MyRankBar, RANK_ROW_HEIGHT, RankRow, UnrankedBar } from '@/features/leaderboard/rank-row';
import { useTheme } from '@/hooks/use-theme';
import { daysUntil, monthName } from '@/lib/format';
import { passGoal } from '@/lib/leaderboard';
import { queryKeys } from '@/lib/query-client';

const SCOPES = [
  { value: 'global', label: 'Global' },
  { value: 'friends', label: 'Friends' },
] as const satisfies readonly { value: LeaderboardScope; label: string }[];

const PODIUM_SIZE = 3;
const VIEWABILITY = { itemVisiblePercentThreshold: 60 };

export default function LeaderboardScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const theme = useTheme();
  const [scope, setScope] = useState<LeaderboardScope>('global');
  // Rows on screen, so the pinned bar can step aside while your own row is showing.
  const [visibleIds, setVisibleIds] = useState<string[]>([]);
  const onViewable = useCallback(({ viewableItems }: { viewableItems: { item: LeaderboardEntry }[] }) => {
    setVisibleIds(viewableItems.map((v) => v.item.user.id));
  }, []);

  const listRef = useRef<FlatList<LeaderboardEntry>>(null);
  // The podium above the rows: its height places every row exactly, so a jump lands where it should.
  const [headerHeight, setHeaderHeight] = useState(0);
  const [jumping, setJumping] = useState(false);

  const query = useInfiniteQuery({
    queryKey: queryKeys.leaderboard(scope),
    queryFn: ({ pageParam }) => api.getLeaderboard({ scope, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });

  const first = query.data?.pages[0];
  const entries = query.data?.pages.flatMap((p) => p.entries) ?? [];
  const me = first?.me ?? null;
  const top = entries.slice(0, PODIUM_SIZE);
  const rest = entries.slice(PODIUM_SIZE);
  // Replay the podium entrance when the scope or the people on it change, not on every refetch.
  const podiumKey = `${scope}:${top.map((e) => e.user.id).join(',')}`;
  const meOnPodium = !!me && top.some((e) => e.user.id === me.user.id);
  /** Load pages until the player's own row is in the list, then scroll it to the middle of the screen. */
  const jumpToMe = async () => {
    if (!me || jumping) return;
    setJumping(true);
    try {
      let loaded = entries;
      let more = query.hasNextPage;
      while (!loaded.some((e) => e.user.id === me.user.id) && more) {
        const next = await query.fetchNextPage();
        loaded = next.data?.pages.flatMap((p) => p.entries) ?? loaded;
        more = next.hasNextPage;
      }
      const index = loaded.slice(PODIUM_SIZE).findIndex((e) => e.user.id === me.user.id);
      if (index >= 0) {
        // Let the list lay out the rows it just received before scrolling into them.
        requestAnimationFrame(() => listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true }));
      }
    } finally {
      setJumping(false);
    }
  };

  const showPinned = !!first && entries.length > 0 && !meOnPodium && !(me && visibleIds.includes(me.user.id));

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView edges={['top']} style={styles.flex}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <ThemedText type="title" accessibilityRole="header">
              Leaderboard
            </ThemedText>
            {first && (
              <View
                accessible
                accessibilityLabel={`${monthName(first.month)} leaderboard resets in ${daysUntil(first.resetsAt)} days`}
                style={[styles.resetChip, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                <Icon name="clock" size={15} color={theme.textSecondary} />
                <ThemedText type="smallBold" themeColor="textSecondary">
                  Resets in <ThemedText type="smallBold">{daysUntil(first.resetsAt)}d</ThemedText>
                </ThemedText>
              </View>
            )}
          </View>
          <SegmentedControl accessibilityLabel="Scope" options={SCOPES} value={scope} onChange={setScope} height={40} />
        </View>

        <QueryState
          query={query}
          loading={<LeaderboardSkeleton />}
          errorTitle="Couldn't load the leaderboard"
          errorArt={<UnpluggedTrophyArt />}>
          {() =>
            entries.length === 0 ? (
              scope === 'friends' ? (
                <EmptyState
                  art={<RaceFriendsArt />}
                  title="Race your friends"
                  hint="Add friends to see how you stack up against them each month."
                  action={<Button title="Find friends" icon="person-add" onPress={() => router.navigate('/friends')} />}
                />
              ) : (
                <EmptyState
                  art={<FreshMonthArt />}
                  title="A fresh month!"
                  hint="Nobody has scored yet. Find a word and take the top spot."
                  action={<Button title="Start hunting" iconNode={<HuntCameraIcon size={20} />} onPress={() => router.navigate('/')} />}
                />
              )
            ) : (
              <FlatList
                ref={listRef}
                style={styles.flex}
                data={rest}
                keyExtractor={(e) => e.user.id}
                contentContainerStyle={styles.list}
                getItemLayout={(_, index) => ({
                  length: RANK_ROW_HEIGHT,
                  offset: headerHeight + RANK_ROW_HEIGHT * index,
                  index,
                })}
                ListHeaderComponent={
                  <View style={styles.podium} onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}>
                    <Podium key={podiumKey} entries={top} myId={user?.id} />
                  </View>
                }
                refreshControl={
                  <RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />
                }
                onEndReached={() => query.hasNextPage && !query.isFetchingNextPage && query.fetchNextPage()}
                onEndReachedThreshold={0.5}
                onViewableItemsChanged={onViewable}
                viewabilityConfig={VIEWABILITY}
                ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator style={styles.more} /> : undefined}
                renderItem={({ item, index }) => (
                  <RankRow
                    entry={item}
                    mine={item.user.id === user?.id}
                    first={index === 0}
                    last={index === rest.length - 1}
                  />
                )}
              />
            )
          }
        </QueryState>

        {showPinned && (
          <View style={styles.pinned}>
            {me ? <MyRankBar entry={me} goal={passGoal(entries, me)} onPress={() => void jumpToMe()} busy={jumping} /> : <UnrankedBar onHunt={() => router.navigate('/')} />}
          </View>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

/** First-load placeholder: three podium blocks and the list card. */
function LeaderboardSkeleton() {
  const theme = useTheme();
  const block = { backgroundColor: theme.backgroundElement, borderColor: theme.border };
  return (
    <View style={styles.skeleton} accessibilityLabel="Loading">
      <View style={styles.skeletonPodium}>
        {[132, 164, 120].map((h) => (
          <View key={h} style={[styles.skeletonBlock, block, { height: h }]} />
        ))}
      </View>
      <View style={[styles.skeletonList, block]} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
    gap: Spacing.two + 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two + 4,
  },
  resetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.two + 4,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
    borderWidth: 2,
    borderBottomWidth: Edge.small,
  },
  podium: {
    marginHorizontal: -Spacing.four,
  },
  list: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
  },
  more: {
    marginVertical: Spacing.three,
  },
  pinned: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  skeleton: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  skeletonPodium: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  skeletonBlock: {
    flex: 1,
    borderRadius: Radius.md,
    borderWidth: 2,
  },
  skeletonList: {
    flex: 1,
    borderRadius: Radius.lg,
    borderWidth: 2,
    borderBottomWidth: Edge.card,
    opacity: 0.85,
  },
});
