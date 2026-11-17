import { FlatList, RefreshControl, StyleSheet } from 'react-native';

import { useBlockedUsers } from '@/api/queries';
import { Button } from '@/components/button';
import { EmptyState, SkeletonRows } from '@/components/empty-state';
import { QueryState } from '@/components/query-state';
import { ThemedView } from '@/components/themed-view';
import { UserRow } from '@/components/user-row';
import { Spacing } from '@/constants/theme';
import { confirmUnblock } from '@/features/safety/safety-menu';
import { useUnblockUser } from '@/features/social/use-friend-mutations';

/** Players you blocked, each with an Unblock button. Reached from Profile → Account. */
export default function BlockedUsersScreen() {
  const blocked = useBlockedUsers();
  const unblock = useUnblockUser();

  return (
    <ThemedView style={styles.flex}>
      <QueryState query={blocked} loading={<SkeletonRows count={3} />} errorTitle="Couldn't load blocked players">
        {(list) => (
          <FlatList
            data={list}
            keyExtractor={(b) => b.user.id}
            contentContainerStyle={styles.content}
            refreshControl={<RefreshControl refreshing={blocked.isRefetching} onRefresh={() => void blocked.refetch()} />}
            ListEmptyComponent={
              <EmptyState icon="users" title="No blocked players" hint="Players you block show up here." />
            }
            renderItem={({ item }) => (
              <UserRow
                user={item.user}
                right={
                  <Button
                    size="small"
                    variant="secondary"
                    title="Unblock"
                    loading={unblock.isPending && unblock.variables === item.user.id}
                    onPress={() => confirmUnblock(item.user, () => unblock.mutate(item.user.id))}
                  />
                }
              />
            )}
          />
        )}
      </QueryState>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
});
