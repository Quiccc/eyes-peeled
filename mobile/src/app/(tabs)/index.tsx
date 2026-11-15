import { useRouter } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useDaily } from '@/api/queries';
import { useAuth } from '@/auth/auth-provider';
import { SkeletonRows } from '@/components/empty-state';
import { QueryState } from '@/components/query-state';
import { ThemedView } from '@/components/themed-view';
import { CARD_MIN_HEIGHT, LockedPremiumCard, WordCard } from '@/components/word-card';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useStartHunt } from '@/features/hunt/use-start-hunt';
import { useShareFind } from '@/features/share/share-find-sheet';
import { fromDailyWord } from '@/features/share/types';
import { TodayHero } from '@/features/today/today-hero';

const PADDING = Spacing.three;
/** Between the hero and the first card. */
const HERO_GAP = Spacing.three;
/** Between two cards. */
const CARD_GAP = Spacing.two + 2;

/**
 * Like the design, every card has the same height and together they fill the space under the hero.
 * When even the minimum height doesn't fit (small phones, large text), they all keep that minimum and the screen scrolls.
 */
function equalCardHeight(viewport: number, hero: number, count: number) {
  if (!viewport || !hero || count === 0) return CARD_MIN_HEIGHT;
  const available = viewport - PADDING - hero - HERO_GAP - BottomTabInset;
  return Math.max(CARD_MIN_HEIGHT, Math.floor((available - CARD_GAP * (count - 1)) / count));
}

export default function TodayScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const daily = useDaily();
  const { openingId, startHunt } = useStartHunt();
  const { share, sheet: shareSheet } = useShareFind();
  const [viewport, setViewport] = useState(0);
  const [hero, setHero] = useState(0);

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView edges={['top']} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.content}
          onLayout={(e) => setViewport(e.nativeEvent.layout.height)}
          refreshControl={<RefreshControl refreshing={daily.isRefetching} onRefresh={() => void daily.refetch()} />}>
          <View onLayout={(e) => setHero(e.nativeEvent.layout.height)}>
            <TodayHero daily={daily.data} />
          </View>

          <QueryState query={daily} loading={<SkeletonRows count={3} height={CARD_MIN_HEIGHT} />} errorTitle="Couldn't load today's words">
            {(data) => {
              const locked = !user?.isPremium;
              const height = equalCardHeight(viewport, hero, data.words.length + (locked ? 1 : 0));
              return (
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
                        style={{ height }}
                      />
                    );
                  })}
                  {locked && <LockedPremiumCard onPress={() => router.push('/premium')} style={{ height }} />}
                </View>
              );
            }}
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
    padding: PADDING,
    gap: HERO_GAP,
    paddingBottom: BottomTabInset,
  },
  cards: {
    gap: CARD_GAP,
  },
});
