import { useQuery } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { showAdPrivacyOptions } from '@/ads/ads';
import { api } from '@/api/endpoints';
import { useAuth } from '@/auth/auth-provider';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { FeedCard } from '@/components/feed-card';
import { ProfileStats } from '@/components/profile-stats';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { displayName, errorMessage } from '@/lib/format';
import { queryKeys } from '@/lib/query-client';

export default function ProfileScreen() {
  const { user, signOut, deleteAccount } = useAuth();
  const profile = useQuery({ queryKey: queryKeys.myProfile, queryFn: api.getMyProfile });
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = () =>
    Alert.alert(
      'Delete account?',
      'This permanently deletes your account, photos, points and friends. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteAccount();
            } catch (e) {
              setDeleting(false);
              Alert.alert('Could not delete account', errorMessage(e));
            }
          },
        },
      ],
    );

  if (!user) return null;

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView edges={['top']} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={profile.isRefetching} onRefresh={() => void profile.refetch()} />}>
          <View style={styles.identity}>
            <Avatar user={user} size={72} />
            <ThemedText type="subtitle">{displayName(user)}</ThemedText>
          </View>

          {profile.isPending ? (
            <ActivityIndicator />
          ) : profile.data ? (
            <>
              <ProfileStats profile={profile.data} />
              {profile.data.today.length > 0 && (
                <View style={styles.section}>
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    YOUR FINDS TODAY
                  </ThemedText>
                  {profile.data.today.map((item) => (
                    <FeedCard key={item.submissionId} item={item} hideAuthor />
                  ))}
                </View>
              )}
            </>
          ) : null}

          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              ACCOUNT
            </ThemedText>
            <Button title="Ad privacy options" variant="secondary" onPress={showAdPrivacyOptions} />
            <Button title="Sign out" variant="secondary" onPress={signOut} />
            <Button title="Delete account" variant="danger" loading={deleting} onPress={confirmDelete} />
          </View>

          <ThemedText type="small" themeColor="textSecondary" style={styles.version}>
            Word Hunt v{Constants.expoConfig?.version ?? '1.0.0'}
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: Spacing.three,
    gap: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  identity: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.three,
  },
  section: {
    gap: Spacing.two,
  },
  version: {
    textAlign: 'center',
  },
});
