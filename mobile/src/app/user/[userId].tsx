import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { api } from '@/api/endpoints';
import type { UserProfile } from '@/api/types';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { FeedCard } from '@/components/feed-card';
import { Icon } from '@/components/icon';
import { ProfileStats } from '@/components/profile-stats';
import { openSafetyMenu } from '@/components/safety-menu';
import { SectionLabel } from '@/components/section-label';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { displayName, errorMessage } from '@/lib/format';
import { queryKeys } from '@/lib/query-client';

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: queryKeys.profile(userId), queryFn: () => api.getUserProfile(userId) });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['users'] });
    queryClient.invalidateQueries({ queryKey: ['friends'] });
    queryClient.invalidateQueries({ queryKey: queryKeys.feed });
    queryClient.invalidateQueries({ queryKey: ['leaderboard', 'friends'] });
  };

  const action = useMutation({
    mutationFn: async (p: UserProfile) => {
      switch (p.friendStatus) {
        case 'none':
          return api.sendFriendRequest(p.user.id);
        case 'incoming':
          return api.respondFriendRequest(p.requestId!, 'accept');
        case 'outgoing':
        case 'friends':
          return api.removeFriend(p.user.id);
      }
    },
    onSuccess: refresh,
    onError: (e) => Alert.alert('Something went wrong', errorMessage(e)),
  });

  const p = profile.data;

  const onPrimary = () => {
    if (!p) return;
    if (p.friendStatus === 'friends') {
      Alert.alert(`Remove ${displayName(p.user)}?`, undefined, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => action.mutate(p) },
      ]);
    } else {
      action.mutate(p);
    }
  };

  const primaryTitle = {
    none: 'Add friend',
    incoming: 'Accept request',
    outgoing: 'Cancel request',
    friends: 'Remove friend',
    blocked: '',
  }[p?.friendStatus ?? 'none'];

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
                onPress={() => openSafetyMenu({ user: p.user, onBlocked: () => (refresh(), router.back()) })}>
                <Icon name="more" size={22} />
              </Pressable>
            ) : null,
        }}
      />
      {profile.isPending ? (
        <ActivityIndicator style={styles.loader} />
      ) : !p ? (
        <ThemedText themeColor="textSecondary" style={styles.muted}>
          {errorMessage(profile.error)}
        </ThemedText>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.identity}>
            <Avatar user={p.user} size={72} />
            <ThemedText type="title" style={styles.name} numberOfLines={1} adjustsFontSizeToFit>
              {p.user.username ?? displayName(p.user)}
            </ThemedText>
          </View>

          {p.friendStatus !== 'blocked' && (
            <Button
              title={primaryTitle}
              variant={p.friendStatus === 'friends' || p.friendStatus === 'outgoing' ? 'secondary' : 'primary'}
              loading={action.isPending}
              onPress={onPrimary}
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
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  name: {
    flex: 1,
    lineHeight: 36,
  },
  section: {
    gap: Spacing.two,
  },
  muted: {
    textAlign: 'center',
    marginVertical: Spacing.three,
  },
});
