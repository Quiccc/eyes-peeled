import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { FeedItem } from '@/api/types';
import { DifficultyPill } from '@/components/pill';
import { ThemedText } from '@/components/themed-text';
import { Edge, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useFormat } from '@/lib/format';

/** One find as a compact tile for a two-column grid: photo, tier pill and points, then the word. */
export function FindTile({ item }: { item: FeedItem }) {
  const fmt = useFormat();
  const { t } = useTranslation();
  const theme = useTheme();
  const word = fmt.displayWord(item.word);
  return (
    <View
      accessible
      accessibilityLabel={[
        word,
        t('format.points', { count: item.points }),
        ...(item.rank ? [t('format.nthFinder', { rank: fmt.ordinal(item.rank) })] : []),
      ].join(', ')}
      style={[styles.tile, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <Image
        source={item.imageUrl}
        style={[styles.photo, { backgroundColor: theme.backgroundSelected }]}
        contentFit="cover"
        transition={200}
      />
      <View style={styles.caption}>
        <View style={styles.meta}>
          <DifficultyPill difficulty={item.difficulty} style={styles.pill} />
          <ThemedText type="smallBold" style={[styles.points, { color: theme.successText }]}>
            +{item.points}
          </ThemedText>
        </View>
        <ThemedText style={styles.word} numberOfLines={1}>
          {word}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 2,
    borderBottomWidth: Edge.button,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: 150,
  },
  caption: {
    gap: Spacing.one,
    paddingHorizontal: 10,
    paddingTop: Spacing.two,
    paddingBottom: 10,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  pill: {
    paddingHorizontal: Spacing.two,
  },
  points: {
    fontVariant: ['tabular-nums'],
  },
  word: {
    fontWeight: 900,
    letterSpacing: 0.5,
  },
});
