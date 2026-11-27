import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View, type TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { invalidateSocial, MIN_SEARCH_LENGTH, useFeedToday, useFriendRequests, useFriendsList, useUserSearch } from '@/api/queries';
import type { FriendStatus, UserSearchResult } from '@/api/types';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { EmptyState, SkeletonRows } from '@/components/empty-state';
import { FeedCard } from '@/components/feed-card';
import { CrashedPlaneArt, PeekingPhotoArt, SquintSearchArt } from '@/components/illustrations/friends-art';
import { SectionLabel } from '@/components/section-label';
import { SegmentedControl } from '@/components/segmented-control';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Edge, Radius, Spacing } from '@/constants/theme';
import { FriendsList } from '@/features/social/friends-list';
import { useSendFriendRequest } from '@/features/social/use-friend-mutations';
import { useDebounced } from '@/hooks/use-debounced';
import { useTheme } from '@/hooks/use-theme';
import { useFormat } from '@/lib/format';

/** Search results show these statuses as text instead of a button. */
const STATUS_KEYS = {
  friends: 'friends.status.friends',
  outgoing: 'friends.status.requested',
  blocked: 'friends.status.blocked',
} as const satisfies Partial<Record<FriendStatus, string>>;

type FriendsView = 'feed' | 'friends';

export default function FriendsScreen() {
  const fmt = useFormat();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const searchRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim(), 300);
  const searching = q.length >= MIN_SEARCH_LENGTH;
  const [view, setView] = useState<FriendsView>('feed');

  const feed = useFeedToday();
  const requests = useFriendRequests();
  const friendsList = useFriendsList();
  const results = useUserSearch(q);
  const add = useSendFriendRequest();

  const statusAction = (userId: string, status: FriendStatus) => {
    if (status in STATUS_KEYS) {
      return (
        <ThemedText type="smallBold" themeColor="textSecondary">
          {t(STATUS_KEYS[status as keyof typeof STATUS_KEYS])}
        </ThemedText>
      );
    }
    return (
      <Button
        size="small"
        title={status === 'incoming' ? t('friends.accept') : t('friends.add')}
        loading={add.isPending && add.variables === userId}
        onPress={() => add.mutate(userId)}
      />
    );
  };

  const finds = feed.data?.length ?? 0;
  const pending = requests.data?.length ?? 0;
  const views: { value: FriendsView; label: string; badge?: number; accessibilityLabel?: string }[] = [
    { value: 'feed', label: t('friends.feedTab') },
    {
      value: 'friends',
      label: t('friends.friendsTab'),
      badge: pending,
      accessibilityLabel: pending ? t('friends.friendsTabPending', { count: pending }) : t('friends.friendsTab'),
    },
  ];
  const showFeed = !searching && view === 'feed';
  const header = (
    <View style={styles.headerBlock}>
      <ThemedText type="title" accessibilityRole="header">
        {t('friends.title')}
      </ThemedText>
      <TextField
        ref={searchRef}
        icon="search"
        value={search}
        onChangeText={setSearch}
        accent={search.length > 0}
        placeholder={t('friends.searchPlaceholder')}
        accessibilityLabel={t('friends.searchPlaceholder')}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
      />

      {searching ? (
        results.isPending ? (
          <ActivityIndicator style={styles.inlineLoader} />
        ) : results.data?.length ? (
          <View style={[styles.group, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            {results.data.map((r, i) => (
              <SearchRow key={r.user.id} result={r} first={i === 0} right={statusAction(r.user.id, r.friendStatus)} />
            ))}
          </View>
        ) : (
          <EmptyState
            art={<SquintSearchArt />}
            title={t('friends.noResultsTitle')}
            hint={t('friends.noResultsHint', { query: q })}
          />
        )
      ) : (
        <>
          <SegmentedControl accessibilityLabel={t('friends.viewA11y')} options={views} value={view} onChange={setView} height={40} />
          {view === 'feed' && (feed.isPending || finds > 0) && (
            <View style={styles.feedLabel}>
              <SectionLabel>{t('friends.feedLabel')}</SectionLabel>
              {finds > 0 && (
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {t('friends.findsCount', { count: finds })}
                </ThemedText>
              )}
            </View>
          )}
        </>
      )}
    </View>
  );

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView edges={['top']} style={styles.flex}>
        <FlatList
          data={showFeed ? (feed.data ?? []) : []}
          keyExtractor={(item) => item.submissionId}
          ListHeaderComponent={header}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={view === 'feed' ? feed.isRefetching : friendsList.isRefetching}
              onRefresh={() => {
                if (view === 'feed') feed.refetch();
                else friendsList.refetch();
                requests.refetch();
              }}
            />
          }
          ListEmptyComponent={
            searching ? undefined : view === 'friends' ? (
              <FriendsList requests={requests.error ? [] : requests.data} onFindHunters={() => searchRef.current?.focus()} />
            ) : feed.isPending ? (
              <SkeletonRows count={2} height={340} />
            ) : feed.error ? (
              <EmptyState
                art={<CrashedPlaneArt />}
                title={t('friends.feedError')}
                hint={fmt.errorMessage(feed.error)}
                action={<Button title={t('common.tryAgain')} variant="secondary" onPress={() => feed.refetch()} />}
              />
            ) : (
              <EmptyState
                art={<PeekingPhotoArt />}
                title={t('friends.feedEmptyTitle')}
                hint={t('friends.feedEmptyHint')}
                action={<Button title={t('friends.findHunters')} icon="person-add" onPress={() => searchRef.current?.focus()} />}
              />
            )
          }
          renderItem={({ item }) => <FeedCard item={item} onBlocked={() => invalidateSocial(queryClient)} />}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

/** A search result as a slice of one grouped card: avatar, name, and the friend status or action. */
function SearchRow({ result, first, right }: { result: UserSearchResult; first: boolean; right: ReactNode }) {
  const fmt = useFormat();
  const theme = useTheme();
  return (
    <View style={styles.searchRow}>
      {!first && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
      <Link href={{ pathname: '/user/[userId]', params: { userId: result.user.id } }} asChild>
        <Pressable accessibilityRole="link" style={styles.searchUser}>
          <Avatar user={result.user} size={40} />
          <ThemedText style={styles.searchName} numberOfLines={1}>
            {fmt.displayName(result.user)}
          </ThemedText>
        </Pressable>
      </Link>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  headerBlock: {
    gap: Spacing.three,
  },
  feedLabel: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: -Spacing.one,
  },
  inlineLoader: {
    marginVertical: Spacing.four,
  },
  group: {
    borderRadius: Radius.lg,
    borderWidth: 2,
    borderBottomWidth: Edge.card,
    overflow: 'hidden',
  },
  searchRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 4,
    paddingVertical: Spacing.two,
    paddingLeft: 14,
    paddingRight: 10,
  },
  searchUser: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 4,
  },
  searchName: {
    flexShrink: 1,
    fontWeight: 900,
  },
  divider: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
  },
});
