import { useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { invalidateSocial, useUserProfile } from '@/api/queries';
import type { UserProfile } from '@/api/types';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { FeedCard } from '@/components/feed-card';
import { Icon } from '@/components/icon';
import { ProfileHeader } from '@/components/profile-header';
import { ProfileStats } from '@/components/profile-stats';
import { QueryState } from '@/components/query-state';
import { SectionLabel } from '@/components/section-label';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { openSafetyMenu } from '@/features/safety/safety-menu';
import { FRIEND_ACTION_TITLE, useFriendAction } from '@/features/social/use-friend-mutations';
import { displayName } from '@/lib/format';

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const profile = useUserProfile(userId);
  const action = useFriendAction();
  const p = profile.data;

  const onPrimary = (p: UserProfile) => {
    if (p.friendStatus !== 'friends') return action.mutate(p);
    Alert.alert(`Remove ${displayName(p.user)}?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => action.mutate(p) },
    ]);
  };

  const onBlocked = () => {
    invalidateSocial(queryClient);
    router.back();
  };

  return (
    <ThemedView style={styles.flex}>
      <Stack.Screen
        options={{
          title: p ? displayName(p.user) : '',
          headerRight: () =>
            p ? (
              <Pressable
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="More options"
                onPress={() => openSafetyMenu({ user: p.user, onBlocked })}>
                <Icon name="more" size={22} />
              </Pressable>
            ) : null,
        }}
      />
      <QueryState query={profile} loading={<ActivityIndicator style={styles.loader} />} errorTitle="Couldn't load this hunter">
        {(p) => (
          <ScrollView contentContainerStyle={styles.content}>
            <ProfileHeader user={p.user} />

            {p.friendStatus !== 'blocked' && (
              <Button
                title={FRIEND_ACTION_TITLE[p.friendStatus]}
                variant={p.friendStatus === 'friends' || p.friendStatus === 'outgoing' ? 'secondary' : 'primary'}
                loading={action.isPending}
                onPress={() => onPrimary(p)}
              />
            )}

            <ProfileStats profile={p} />

            <View style={styles.section}>
              <SectionLabel>TODAY&apos;S FINDS</SectionLabel>
              {p.friendStatus !== 'friends' ? (
                <EmptyState icon="lock" title="Photos are for friends" hint="Become friends to see their finds." />
              ) : p.today.length === 0 ? (
                <EmptyState icon="camera" title="Nothing found yet today" />
              ) : (
                p.today.map((item) => <FeedCard key={item.submissionId} item={item} hideAuthor />)
              )}
            </View>
          </ScrollView>
        )}
      </QueryState>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loader: { marginTop: Spacing.six },
  content: {
    padding: Spacing.four,
    gap: 20,
    paddingBottom: Spacing.six,
  },
  section: {
    gap: Spacing.two,
  },
});
