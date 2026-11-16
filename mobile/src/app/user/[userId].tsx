import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { invalidateSocial, useUserProfile } from '@/api/queries';
import type { FriendStatus, UserProfile } from '@/api/types';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { FeedCard } from '@/components/feed-card';
import { Icon, type IconName } from '@/components/icon';
import { ProfileHeader } from '@/components/profile-header';
import { ProfileStats } from '@/components/profile-stats';
import { QueryState } from '@/components/query-state';
import { SectionLabel } from '@/components/section-label';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { openSafetyMenu } from '@/features/safety/safety-menu';
import { FRIEND_ACTION_TITLE, useFriendAction } from '@/features/social/use-friend-mutations';
import { useTheme } from '@/hooks/use-theme';
import { displayName } from '@/lib/format';

const FRIEND_ACTION_ICON: Partial<Record<FriendStatus, IconName>> = {
  none: 'person-add',
  incoming: 'check',
  outgoing: 'close',
  friends: 'person-remove',
};

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const theme = useTheme();
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
      <SafeAreaView edges={['top']} style={styles.flex}>
        {/* The app's own header bar: back, the hunter's name, and the safety menu. */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.headerButton, { opacity: pressed ? 0.6 : 1 }]}>
            <Icon name="chevron-left" size={24} />
          </Pressable>
          <ThemedText style={styles.headerTitle} numberOfLines={1} accessibilityRole="header">
            {p ? displayName(p.user) : ''}
          </ThemedText>
          {p ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="More options"
              onPress={() => openSafetyMenu({ user: p.user, onBlocked })}
              style={({ pressed }) => [styles.headerButton, { opacity: pressed ? 0.6 : 1 }]}>
              <Icon name="more" size={22} />
            </Pressable>
          ) : (
            <View style={styles.headerButton} />
          )}
        </View>

        <QueryState query={profile} loading={<ActivityIndicator style={styles.loader} />} errorTitle="Couldn't load this hunter">
          {(p) => (
            <ScrollView contentContainerStyle={styles.content}>
              <ProfileHeader user={p.user} ring="hue" />

              {p.friendStatus !== 'blocked' && (
                <Button
                  title={FRIEND_ACTION_TITLE[p.friendStatus]}
                  icon={FRIEND_ACTION_ICON[p.friendStatus]}
                  variant={p.friendStatus === 'friends' || p.friendStatus === 'outgoing' ? 'secondary' : 'primary'}
                  loading={action.isPending}
                  onPress={() => onPrimary(p)}
                />
              )}

              <ProfileStats profile={p} />

              <View style={styles.section}>
                <SectionLabel>TODAY&apos;S FINDS</SectionLabel>
                {p.friendStatus !== 'friends' ? (
                  <EmptyState boxed icon="lock" title="Photos are for friends" hint="Become friends to see their finds." />
                ) : p.today.length === 0 ? (
                  <EmptyState boxed icon="camera" title="Nothing found yet today" />
                ) : (
                  p.today.map((item) => <FeedCard key={item.submissionId} item={item} hideAuthor />)
                )}
              </View>
            </ScrollView>
          )}
        </QueryState>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    height: 56,
    paddingHorizontal: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 2,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flexShrink: 1,
    fontWeight: 900,
    textAlign: 'center',
  },
  loader: { marginTop: Spacing.six },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: 20,
    gap: 20,
    paddingBottom: Spacing.six,
  },
  section: {
    gap: Spacing.two + 2,
  },
});
