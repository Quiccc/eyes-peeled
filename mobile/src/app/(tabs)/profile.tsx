import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { showAdPrivacyOptions } from '@/ads/ads';
import { useMyProfile } from '@/api/queries';
import { useAuth } from '@/auth/auth-provider';
import { SignInCancelled } from '@/auth/social-sign-in';
import { FeedCard } from '@/components/feed-card';
import { ProfileHeader } from '@/components/profile-header';
import { ProfileStats } from '@/components/profile-stats';
import { SectionLabel } from '@/components/section-label';
import { SegmentedControl } from '@/components/segmented-control';
import { DangerLink, SettingsGroup, type SettingsRow } from '@/components/settings-group';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { PremiumStatusCard } from '@/features/premium/premium-status-card';
import { usePremiumPurchase } from '@/features/premium/use-premium-purchase';
import { useShareFind } from '@/features/share/share-find-sheet';
import { fromFeedItem } from '@/features/share/types';
import { useAsyncAction } from '@/hooks/use-async-action';
import { setAppearance, useAppearancePref, type AppearancePref } from '@/lib/appearance';

const APPEARANCE_OPTIONS: readonly { value: AppearancePref; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export default function ProfileScreen() {
  const { user, signOut, deleteAccount } = useAuth();
  const router = useRouter();
  const profile = useMyProfile();
  const appearance = useAppearancePref();
  const { share, sheet: shareSheet } = useShareFind();
  const premium = usePremiumPurchase({
    onPremium: () => Alert.alert('Premium restored', 'Ads are off and the Premium word is unlocked.'),
  });
  const deletion = useAsyncAction<'delete'>();

  const confirmDelete = () =>
    Alert.alert(
      'Delete account?',
      'This permanently deletes your account, photos, points and friends. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            deletion.run('delete', deleteAccount, {
              errorTitle: 'Could not delete account',
              // Dismissed the Apple confirmation sheet: keep the account, no error.
              ignore: (e) => e instanceof SignInCancelled,
            }),
        },
      ],
    );

  if (!user) return null;

  const accountRows: SettingsRow[] = [
    { title: 'Restore purchases', onPress: premium.restore, loading: premium.busy === 'restore' },
    ...(user.isPremium ? [] : [{ title: 'Ad privacy options', onPress: showAdPrivacyOptions }]),
    { title: 'Blocked users', onPress: () => router.push('/blocked') },
    { title: 'Sign out', onPress: signOut },
  ];

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView edges={['top']} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={profile.isRefetching} onRefresh={() => void profile.refetch()} />}>
          <ProfileHeader user={user} ring />

          {profile.isPending ? (
            <ActivityIndicator />
          ) : profile.data ? (
            <ProfileStats profile={profile.data} />
          ) : null}

          <PremiumStatusCard isPremium={user.isPremium} />

          {profile.data && profile.data.today.length > 0 && (
            <View style={styles.section}>
              <SectionLabel>YOUR FINDS TODAY</SectionLabel>
              {profile.data.today.map((item) => (
                <FeedCard key={item.submissionId} item={item} hideAuthor onShare={() => share(fromFeedItem(item))} />
              ))}
            </View>
          )}

          <View style={styles.section}>
            <SectionLabel>APPEARANCE</SectionLabel>
            <SegmentedControl
              accessibilityLabel="Appearance"
              options={APPEARANCE_OPTIONS}
              value={appearance}
              onChange={(pref) => void setAppearance(pref)}
            />
          </View>

          <View style={[styles.section, styles.account]}>
            <SectionLabel>ACCOUNT</SectionLabel>
            <SettingsGroup rows={accountRows} />
            <DangerLink title="Delete account" loading={deletion.busy === 'delete'} onPress={confirmDelete} />
          </View>

          <ThemedText type="small" themeColor="textSecondary" style={styles.version}>
            Eyes Peeled v{Constants.expoConfig?.version ?? '1.0.0'}
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
      {shareSheet}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: Spacing.four,
    gap: 20,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  section: {
    gap: Spacing.two,
  },
  account: {
    gap: 12,
  },
  version: {
    textAlign: 'center',
  },
});
