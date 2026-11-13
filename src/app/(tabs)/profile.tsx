import { useQuery, useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { showAdPrivacyOptions } from '@/ads/ads';
import { api } from '@/api/endpoints';
import { useAuth } from '@/auth/auth-provider';
import { Avatar } from '@/components/avatar';
import { Chunky } from '@/components/chunky';
import { FeedCard } from '@/components/feed-card';
import { Icon } from '@/components/icon';
import { ProfileStats } from '@/components/profile-stats';
import { SectionLabel } from '@/components/section-label';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Edge, Radius, Spacing } from '@/constants/theme';
import { useShareFind } from '@/features/share/share-find-sheet';
import { fromFeedItem } from '@/features/share/types';
import { useTheme } from '@/hooks/use-theme';
import { displayName, errorMessage } from '@/lib/format';
import { setAppearance, useAppearancePref, type AppearancePref } from '@/lib/appearance';
import { queryKeys } from '@/lib/query-client';
import { restorePremium } from '@/purchases/purchases';

const APPEARANCE_OPTIONS: readonly { value: AppearancePref; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export default function ProfileScreen() {
  const { user, signOut, deleteAccount, updateUser } = useAuth();
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: queryKeys.myProfile, queryFn: api.getMyProfile });
  const [deleting, setDeleting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const appearance = useAppearancePref();
  const { share, sheet: shareSheet } = useShareFind();

  const restore = async () => {
    setRestoring(true);
    try {
      const updated = await restorePremium();
      updateUser(updated);
      await queryClient.invalidateQueries({ queryKey: queryKeys.daily });
      Alert.alert(
        updated.isPremium ? 'Premium restored' : 'Nothing to restore',
        updated.isPremium ? 'Ads are off and the Premium word is unlocked.' : 'No Premium purchase was found for this store account.',
      );
    } catch (e) {
      Alert.alert('Could not restore purchases', errorMessage(e));
    } finally {
      setRestoring(false);
    }
  };

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
            <Avatar user={user} size={72} ring />
            <ThemedText type="title" style={styles.name} numberOfLines={1} adjustsFontSizeToFit accessibilityRole="header">
              {user.username ?? displayName(user)}
            </ThemedText>
          </View>

          {profile.isPending ? (
            <ActivityIndicator />
          ) : profile.data ? (
            <ProfileStats profile={profile.data} />
          ) : null}

          {user.isPremium ? (
            <View style={[styles.premiumActive, { backgroundColor: theme.easyBg }]}>
              <Icon name="check" size={18} color={theme.easyText} />
              <ThemedText type="smallBold" style={{ color: theme.easyText }}>
                Premium active: no ads, Premium word unlocked
              </ThemedText>
            </View>
          ) : (
            <Chunky
              color={theme.tint}
              edgeColor={theme.tintEdge}
              radius={20}
              accessibilityRole="link"
              accessibilityLabel="Remove ads and unlock the Premium word. One purchase, yours forever."
              onPress={() => router.push('/premium')}
              contentStyle={styles.upsell}>
              <Icon name="star" size={28} color={theme.onTint} />
              <View style={styles.upsellText}>
                <ThemedText style={[styles.upsellTitle, { color: theme.onTint }]}>Remove ads &amp; unlock the Premium word</ThemedText>
                <ThemedText type="small" style={{ color: theme.onTint }}>
                  One purchase, yours forever
                </ThemedText>
              </View>
              <Icon name="chevron-right" size={20} color={theme.onTint} />
            </Chunky>
          )}

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

          <View style={styles.section}>
            <SectionLabel>ACCOUNT</SectionLabel>
            <View style={[styles.group, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              {[
                { title: 'Restore purchases', onPress: restore, loading: restoring, show: true },
                { title: 'Ad privacy options', onPress: showAdPrivacyOptions, loading: false, show: !user.isPremium },
                { title: 'Sign out', onPress: signOut, loading: false, show: true },
              ]
                .filter((row) => row.show)
                .map((row, i) => (
                  <Pressable
                    key={row.title}
                    accessibilityRole="button"
                    disabled={row.loading}
                    onPress={row.onPress}
                    style={({ pressed }) => [
                      styles.groupRow,
                      i > 0 && { borderTopWidth: 2, borderTopColor: theme.border },
                      pressed && { backgroundColor: theme.backgroundSelected },
                    ]}>
                    <ThemedText style={styles.groupLabel}>{row.title}</ThemedText>
                    {row.loading && <ActivityIndicator color={theme.textSecondary} />}
                  </Pressable>
                ))}
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={deleting}
              onPress={confirmDelete}
              style={({ pressed }) => [styles.delete, { opacity: pressed ? 0.6 : 1 }]}>
              {deleting ? (
                <ActivityIndicator color={theme.dangerText} />
              ) : (
                <ThemedText type="smallBold" style={{ color: theme.dangerText }}>
                  Delete account
                </ThemedText>
              )}
            </Pressable>
          </View>

          <ThemedText type="small" themeColor="textSecondary" style={styles.version}>
            Word Hunt v{Constants.expoConfig?.version ?? '1.0.0'}
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
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  name: {
    flex: 1,
    lineHeight: 36,
  },
  premiumActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three - 2,
    borderRadius: Radius.md,
  },
  upsell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 4,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
  },
  upsellText: {
    flex: 1,
  },
  upsellTitle: {
    fontWeight: 900,
  },
  section: {
    gap: Spacing.two,
  },
  group: {
    borderRadius: 18,
    borderWidth: 2,
    borderBottomWidth: Edge.button,
    overflow: 'hidden',
  },
  groupRow: {
    minHeight: 52,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupLabel: {
    fontWeight: 900,
  },
  delete: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  version: {
    textAlign: 'center',
  },
});
