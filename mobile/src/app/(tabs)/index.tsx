import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useDaily } from '@/api/queries';
import type { DailyWord } from '@/api/types';
import { useAuth } from '@/auth/auth-provider';
import { QueryState } from '@/components/query-state';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useStartHunt } from '@/features/hunt/use-start-hunt';
import { useShareFind } from '@/features/share/share-find-sheet';
import { fromDailyWord } from '@/features/share/types';
import { TodayHeader } from '@/features/today/today-header';
import { TodayScoreboard } from '@/features/today/today-scoreboard';
import { Trail, TrailSkeleton } from '@/features/today/trail';

/**
 * Header, scoreboard and the trail of today's words. The header and scoreboard keep one shape from the first
 * frame (placeholders while loading); the trail fills the rest of the screen and scrolls only when it can't fit.
 */
export default function TodayScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const premium = !!user?.isPremium;
  const daily = useDaily();
  const { openingId, startHunt } = useStartHunt();
  const { share, sheet: shareSheet } = useShareFind();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // The server includes the expert word exactly when it considers the user Premium. If today's words
  // disagree with our copy of the user (a refund or purchase landed since we loaded it), reload the user
  // so ads, the Profile card and the trail all agree. Once per daily response.
  const dailyHasExpert = daily.data?.words.some((w) => w.difficulty === 'expert');
  const premiumMismatch = dailyHasExpert !== undefined && dailyHasExpert !== premium;
  useEffect(() => {
    if (premiumMismatch) void refreshUser();
  }, [premiumMismatch, daily.dataUpdatedAt, refreshUser]);

  const shareFor = (word: DailyWord) => {
    const find = fromDailyWord(word);
    return find ? () => share(find) : undefined;
  };

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView edges={['top']} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={daily.isRefetching} onRefresh={() => void daily.refetch()} />}>
          <TodayHeader />
          <View style={styles.scoreboard}>
            <TodayScoreboard daily={daily.data} premium={premium} />
          </View>
          <View style={styles.trail}>
            <QueryState
              query={daily}
              loading={<TrailSkeleton count={premium ? 4 : 3} locked={!premium} />}
              errorTitle={t('today.loadError')}>
              {(data) => (
                <Trail
                  words={data.words}
                  locked={!premium}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  openingId={openingId}
                  onHunt={startHunt}
                  shareFor={shareFor}
                  onUnlock={() => router.push('/premium')}
                />
              )}
            </QueryState>
          </View>
        </ScrollView>
      </SafeAreaView>
      {shareSheet}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  scoreboard: {
    marginTop: Spacing.two + 4,
  },
  trail: {
    flexGrow: 1,
    marginTop: Spacing.two + 2,
  },
});
