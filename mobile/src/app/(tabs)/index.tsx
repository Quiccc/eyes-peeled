import { useRouter } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';
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
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={daily.isRefetching} onRefresh={() => void daily.refetch()} />}>
          <TodayHero daily={daily.data} />

          <QueryState query={daily} loading={<SkeletonRows count={3} height={104} />} errorTitle="Couldn't load today's words">
            {(data) => (
              <>
                {data.words.map((word) => {
                  const shareable = fromDailyWord(word);
                  return (
                    <WordCard
                      key={word.id}
                      word={word}
                      busy={openingId === word.id}
                      onPress={() => startHunt(word)}
                      onShare={shareable ? () => share(shareable) : undefined}
                    />
                  );
                })}
                {!user?.isPremium && <LockedPremiumCard onPress={() => router.push('/premium')} />}
              </>
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
    padding: Spacing.three,
    gap: Spacing.two + 2,
    paddingBottom: BottomTabInset + Spacing.three,
  },
});
