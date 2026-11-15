import { useRouter } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useDaily } from '@/api/queries';
import { useAuth } from '@/auth/auth-provider';
import { SkeletonRows } from '@/components/empty-state';
import { QueryState } from '@/components/query-state';
import { ThemedView } from '@/components/themed-view';
import { LockedPremiumCard, WordCard } from '@/components/word-card';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useStartHunt } from '@/features/hunt/use-start-hunt';
import { useShareFind } from '@/features/share/share-find-sheet';
import { fromDailyWord } from '@/features/share/types';
import { TodayHero } from '@/features/today/today-hero';

export default function TodayScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const daily = useDaily();
  const { openingId, startHunt } = useStartHunt();
  const { share, sheet: shareSheet } = useShareFind();

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView edges={['top']} style={styles.flex}>
        {/* Like the design, the cards share the screen's height; it only scrolls when they don't fit. */}
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={daily.isRefetching} onRefresh={() => void daily.refetch()} />}>
          <TodayHero daily={daily.data} />

          <QueryState query={daily} loading={<SkeletonRows count={3} height={104} />} errorTitle="Couldn't load today's words">
            {(data) => (
              <View style={styles.cards}>
                {data.words.map((word) => {
                  const shareable = fromDailyWord(word);
                  return (
                    <WordCard
                      key={word.id}
                      word={word}
                      busy={openingId === word.id}
                      onPress={() => startHunt(word)}
                      onShare={shareable ? () => share(shareable) : undefined}
                      style={styles.card}
                    />
                  );
                })}
                {!user?.isPremium && <LockedPremiumCard onPress={() => router.push('/premium')} style={styles.card} />}
              </View>
            )}
          </QueryState>
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
    padding: Spacing.three,
    gap: Spacing.three,
    paddingBottom: BottomTabInset,
  },
  cards: {
    flexGrow: 1,
    gap: Spacing.two + 2,
  },
  card: {
    flexGrow: 1,
    flexBasis: 0,
    minHeight: 96,
  },
});
