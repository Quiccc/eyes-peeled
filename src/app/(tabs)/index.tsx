import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { showInterstitial } from '@/ads/ads';
import { api } from '@/api/endpoints';
import type { Daily, DailyWord } from '@/api/types';
import { useAuth } from '@/auth/auth-provider';
import { Button } from '@/components/button';
import { Chunky } from '@/components/chunky';
import { Countdown } from '@/components/countdown';
import { EmptyState, SkeletonRows } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LockedPremiumCard, WordCard } from '@/components/word-card';
import { BottomTabInset, Edge, Spacing } from '@/constants/theme';
import { useShareFind } from '@/features/share/share-find-sheet';
import { fromDailyWord } from '@/features/share/types';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/format';
import { queryKeys } from '@/lib/query-client';

export default function TodayScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data, isPending, error, refetch, isRefetching } = useQuery({
    queryKey: queryKeys.daily,
    queryFn: api.getDaily,
  });
  const [openingId, setOpeningId] = useState<string | null>(null);
  const { share, sheet: shareSheet } = useShareFind();

  const startHunt = async (word: DailyWord) => {
    // A pending word reopens its in-flight result, so it isn't a new attempt and gets no ad.
    if (word.status !== 'pending') {
      setOpeningId(word.id);
      try {
        await showInterstitial(); // ad on difficulty selection
      } finally {
        setOpeningId(null);
      }
    }
    router.push({ pathname: '/hunt/[wordId]', params: { wordId: word.id } });
  };

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView edges={['top']} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}>
          <Hero daily={data} />

          {isPending ? (
            <SkeletonRows count={3} height={104} />
          ) : error ? (
            <EmptyState
              icon="retry"
              title="Couldn't load today's words"
              hint={errorMessage(error)}
              action={<Button title="Try again" variant="secondary" onPress={() => refetch()} />}
            />
          ) : (
            <>
              {data.words.map((word) => {
                const shareable = fromDailyWord(word);
                return (
                  <WordCard
                    key={word.id}
                    word={word}
                    busy={openingId === word.id}
                    onPress={() => !openingId && startHunt(word)}
                    onShare={shareable ? () => share(shareable) : undefined}
                  />
                );
              })}
              {!user?.isPremium && <LockedPremiumCard onPress={() => router.push('/premium')} />}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
      {shareSheet}
    </ThemedView>
  );
}

/** The orange header card: streak, countdown to new words and today's progress. */
function Hero({ daily }: { daily: Daily | undefined }) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: queryKeys.myProfile, queryFn: api.getMyProfile });
  const streak = profile.data?.streak;

  const words = daily?.words ?? [];
  const found = words.filter((w) => w.status === 'found').length;
  const points = words.reduce((sum, w) => sum + (w.submission?.points ?? 0), 0);
  const progress = words.length ? found / words.length : 0;
  const ink = { color: theme.onTint };

  return (
    <Chunky color={theme.tint} edgeColor={theme.tintEdge} radius={28} edge={Edge.card} contentStyle={styles.hero}>
      <View style={styles.heroTop}>
        <ThemedText type="title" style={ink} accessibilityRole="header">
          Today&apos;s hunt
        </ThemedText>
        {streak !== undefined && (
          <View style={styles.streak} accessible accessibilityLabel={`${streak} day streak`}>
            <Icon name="flame" size={18} color="#2B1600" />
            <ThemedText style={styles.streakText}>{streak}</ThemedText>
          </View>
        )}
      </View>

      {daily && (
        <>
          <View>
            <Countdown
              type="display"
              style={[ink, styles.countdown]}
              target={daily.nextResetAt}
              onExpire={() => queryClient.invalidateQueries({ queryKey: queryKeys.daily })}
            />
            <View style={styles.inline}>
              <Icon name="clock" size={16} color={theme.onTint} />
              <ThemedText type="small" style={ink}>
                until new words
              </ThemedText>
            </View>
          </View>

          <View style={styles.progressBlock}>
            <View style={styles.progressLabels}>
              <ThemedText type="smallBold" style={ink}>
                {found}/{words.length} found
              </ThemedText>
              <ThemedText type="smallBold" style={ink}>
                {points.toLocaleString()} pts today
              </ThemedText>
            </View>
            <View
              style={styles.track}
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={`${found} of ${words.length} words found`}
              accessibilityValue={{ min: 0, max: words.length, now: found }}>
              <View style={[styles.fill, { width: `${progress * 100}%` }]} />
            </View>
          </View>
        </>
      )}
    </Chunky>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: Spacing.three,
    gap: Spacing.two + 2,
    paddingBottom: BottomTabInset + Spacing.three,
  },
  hero: {
    padding: 20,
    gap: Spacing.two + 4,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two + 4,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  streakText: {
    color: '#2B1600',
    fontWeight: 900,
  },
  countdown: {
    letterSpacing: 1,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressBlock: {
    gap: 6,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  track: {
    height: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(43, 22, 0, 0.25)',
    overflow: 'hidden',
  },
  fill: {
    height: 12,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
});
