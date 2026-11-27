import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { showAdPrivacyOptions, useAdPrivacyOptionsRequired } from '@/ads/ads';
import { useMyProfile } from '@/api/queries';
import { useAuth } from '@/auth/auth-provider';
import { SignInCancelled } from '@/auth/social-sign-in';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { FeedCard, FeedCardSkeleton } from '@/components/feed-card';
import { CrashedPlaneArt } from '@/components/illustrations/friends-art';
import {
  AppearanceIcon,
  BlockedIcon,
  LanguageIcon,
  PrivacyIcon,
  RestoreIcon,
  SETTINGS_TILE,
  SignOutIcon,
} from '@/components/profile-icons';
import { ProfileHeader } from '@/components/profile-header';
import { ProfileStats } from '@/components/profile-stats';
import { SectionLabel } from '@/components/section-label';
import { SegmentedControl } from '@/components/segmented-control';
import { DangerLink, SettingsGroup, type SettingsRow } from '@/components/settings-group';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Edge, Radius, Spacing } from '@/constants/theme';
import { NoFindsCard } from '@/features/profile/no-finds-card';
import { useAvatarPicker } from '@/features/profile/use-avatar-picker';
import { PremiumStatusCard } from '@/features/premium/premium-status-card';
import { usePremiumPurchase } from '@/features/premium/use-premium-purchase';
import { useShareFind } from '@/features/share/share-find-sheet';
import { fromFeedItem } from '@/features/share/types';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useTheme } from '@/hooks/use-theme';
import { LANGUAGES } from '@/i18n/languages';
import { useLanguagePref } from '@/i18n/language';
import { setAppearance, useAppearancePref, type AppearancePref } from '@/lib/appearance';
import { useFormat } from '@/lib/format';

/** Content column width cap, so tablets and landscape get a phone-width column instead of a stretched one. */
const MAX_WIDTH = 480;

const APPEARANCES = ['system', 'light', 'dark'] as const satisfies readonly AppearancePref[];

/**
 * The signed-in hunter: who they are, how they're doing, Premium, today's finds, then settings.
 * Everything above the finds keeps its shape from the first frame (the header and Premium card come from the
 * signed-in user; the stats are placeholder tiles while they load). The finds slot keeps at least the loading
 * card's height once it has measured it, so the appearance and account sections never jump.
 */
export default function ProfileScreen() {
  const fmt = useFormat();
  const { t } = useTranslation();
  const { user, signOut, deleteAccount } = useAuth();
  const router = useRouter();
  const theme = useTheme();
  const profile = useMyProfile();
  const appearance = useAppearancePref();
  const languagePref = useLanguagePref();
  const appearanceOptions = APPEARANCES.map((value) => ({
    value,
    label: t(`profile.appearance.${value}`),
    icon: (selected: boolean) => <AppearanceIcon name={value} selected={selected} />,
  }));
  const { share, sheet: shareSheet } = useShareFind();
  const premium = usePremiumPurchase({
    onPremium: () => Alert.alert(t('premium.restoredTitle'), t('premium.restoredBody')),
  });
  const deletion = useAsyncAction<'delete'>();
  const avatar = useAvatarPicker();
  const [findsHeight, setFindsHeight] = useState(0);
  const privacyOptionsRequired = useAdPrivacyOptionsRequired();

  const confirmDelete = () =>
    Alert.alert(
      t('profile.deleteTitle'),
      t('profile.deleteBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.deleteConfirm'),
          style: 'destructive',
          onPress: () =>
            deletion.run('delete', deleteAccount, {
              errorTitle: t('profile.deleteError'),
              // Dismissed the Apple confirmation sheet: keep the account, no error.
              ignore: (e) => e instanceof SignInCancelled,
            }),
        },
      ],
    );

  if (!user) return null;

  const accountRows: SettingsRow[] = [
    {
      title: t('language.rowTitle', {
        language:
          languagePref === 'system'
            ? t('language.system')
            : LANGUAGES.find((l) => l.locale === languagePref)?.name ?? languagePref,
      }),
      onPress: () => router.push('/language'),
      icon: <LanguageIcon />,
      tileColor: SETTINGS_TILE.language,
    },
    {
      title: t('profile.restorePurchases'),
      onPress: premium.restore,
      loading: premium.busy === 'restore',
      icon: <RestoreIcon />,
      tileColor: SETTINGS_TILE.restore,
    },
    ...(user.isPremium || !privacyOptionsRequired
      ? []
      : [{ title: t('profile.adPrivacy'), onPress: showAdPrivacyOptions, icon: <PrivacyIcon />, tileColor: SETTINGS_TILE.privacy }]),
    { title: t('blocked.title'), onPress: () => router.push('/blocked'), icon: <BlockedIcon />, tileColor: SETTINGS_TILE.blocked },
    { title: t('profile.signOut'), onPress: signOut, icon: <SignOutIcon />, tileColor: SETTINGS_TILE.signOut },
  ];

  const finds = profile.data?.today;
  const fill = { minHeight: findsHeight };

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={profile.isRefetching} onRefresh={() => void profile.refetch()} />}>
          <View style={styles.column}>
            <ProfileHeader
              user={user}
              ring
              premium={user.isPremium}
              onEditAvatar={avatar.open}
              avatarBusy={avatar.busy}
            />

            <ProfileStats profile={profile.data} loading={profile.isPending} />

            <PremiumStatusCard isPremium={user.isPremium} />

            <View style={styles.section}>
              <SectionLabel>{t('profile.findsToday')}</SectionLabel>
              {finds && finds.length > 0 ? (
                <View style={[styles.finds, fill]}>
                  {finds.map((item) => (
                    <FeedCard key={item.submissionId} item={item} hideAuthor onShare={() => share(fromFeedItem(item))} />
                  ))}
                </View>
              ) : finds ? (
                <NoFindsCard style={[styles.grow, fill]} />
              ) : profile.isPending ? (
                <View onLayout={(e) => setFindsHeight(e.nativeEvent.layout.height)}>
                  <FeedCardSkeleton />
                </View>
              ) : (
                <View style={[styles.errorCard, fill, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                  <EmptyState
                    art={<CrashedPlaneArt />}
                    title={t('profile.findsError')}
                    hint={fmt.errorMessage(profile.error)}
                    action={<Button title={t('common.tryAgain')} variant="secondary" onPress={() => profile.refetch()} />}
                  />
                </View>
              )}
            </View>

            <View style={styles.section}>
              <SectionLabel>{t('profile.appearance.label')}</SectionLabel>
              <SegmentedControl
                accessibilityLabel={t('profile.appearance.a11y')}
                options={appearanceOptions}
                value={appearance}
                onChange={(pref) => void setAppearance(pref)}
              />
            </View>

            <View style={styles.section}>
              <SectionLabel>{t('profile.account')}</SectionLabel>
              <SettingsGroup rows={accountRows} />
              <DangerLink title={t('profile.deleteAccount')} loading={deletion.busy === 'delete'} onPress={confirmDelete} />
            </View>

            <ThemedText type="small" themeColor="textSecondary" style={styles.version}>
              {t('profile.version', { version: Constants.expoConfig?.version ?? '1.0.0' })}
            </ThemedText>
          </View>
        </ScrollView>
      </SafeAreaView>
      {shareSheet}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    alignItems: 'center',
    paddingBottom: BottomTabInset,
  },
  column: {
    width: '100%',
    maxWidth: MAX_WIDTH,
    padding: Spacing.four,
    gap: Spacing.four,
  },
  section: {
    gap: Spacing.two,
  },
  finds: {
    gap: 12,
  },
  grow: {
    flexGrow: 1,
  },
  errorCard: {
    justifyContent: 'center',
    borderRadius: Radius.lg,
    borderWidth: 2,
    borderBottomWidth: Edge.button,
  },
  version: {
    textAlign: 'center',
  },
});
