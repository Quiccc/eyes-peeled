import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { showInterstitial } from '@/ads/ads';
import { api } from '@/api/endpoints';
import type { DailyWord } from '@/api/types';
import { Button } from '@/components/button';
import { Countdown } from '@/components/countdown';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WordCard } from '@/components/word-card';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { errorMessage } from '@/lib/format';
import { queryKeys } from '@/lib/query-client';

export default function TodayScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data, isPending, error, refetch, isRefetching } = useQuery({
    queryKey: queryKeys.daily,
    queryFn: api.getDaily,
  });
  const [openingId, setOpeningId] = useState<string | null>(null);

  const startHunt = async (word: DailyWord) => {
    setOpeningId(word.id);
    try {
      await showInterstitial(); // ad on difficulty selection
    } finally {
      setOpeningId(null);
    }
    router.push({ pathname: '/hunt/[wordId]', params: { wordId: word.id } });
  };

  const foundCount = data?.words.filter((w) => w.status === 'found').length ?? 0;
  const todayPoints = data?.words.reduce((sum, w) => sum + (w.submission?.points ?? 0), 0) ?? 0;

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView edges={['top']} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Today&apos;s hunt</ThemedText>
            {data && (
              <View style={styles.headerRow}>
                <ThemedText type="small" themeColor="textSecondary">
                  New words in{' '}
                </ThemedText>
                <Countdown
                  type="smallBold"
                  target={data.nextResetAt}
                  onExpire={() => queryClient.invalidateQueries({ queryKey: queryKeys.daily })}
                />
                <ThemedText type="small" themeColor="textSecondary">
                  {'  ·  '}
                  {foundCount}/3 found · {todayPoints} pts
                </ThemedText>
              </View>
            )}
          </View>

          {isPending ? (
            <ActivityIndicator style={styles.loader} />
          ) : error ? (
            <View style={styles.error}>
              <ThemedText themeColor="textSecondary">{errorMessage(error)}</ThemedText>
              <Button title="Try again" variant="secondary" onPress={() => refetch()} />
            </View>
          ) : (
            data.words.map((word) => (
              <WordCard
                key={word.id}
                word={word}
                busy={openingId === word.id}
                onPress={() => !openingId && startHunt(word)}
              />
            ))
          )}

          <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
            Find the real thing, not a picture of it. The earlier you snap it, the more points you get.
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
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  header: {
    gap: Spacing.one,
    paddingVertical: Spacing.two,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  loader: {
    marginTop: Spacing.six,
  },
  error: {
    gap: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.five,
  },
  hint: {
    textAlign: 'center',
    paddingHorizontal: Spacing.three,
  },
});
