import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import type { DailyWord } from '@/api/types';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { DIFFICULTY_LABEL, ordinal } from '@/lib/format';

type Props = {
  word: DailyWord;
  onPress: () => void;
  busy?: boolean;
};

export function WordCard({ word, onPress, busy }: Props) {
  const theme = useTheme();
  const accent = theme[word.difficulty];
  const found = word.status === 'found';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${DIFFICULTY_LABEL[word.difficulty]}: ${word.word}${found ? ', found' : ''}`}
      disabled={found || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.backgroundElement, borderColor: accent, opacity: pressed ? 0.85 : 1 },
      ]}>
      <View style={styles.header}>
        <View style={[styles.pill, { backgroundColor: accent }]}>
          <ThemedText type="smallBold" style={{ color: theme.onTint }}>
            {DIFFICULTY_LABEL[word.difficulty]}
          </ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          up to {word.maxPoints} pts
        </ThemedText>
      </View>

      <View style={styles.body}>
        <View style={styles.wordCol}>
          <ThemedText style={styles.word} numberOfLines={2}>
            {word.word.toUpperCase()}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {word.foundCount.toLocaleString()} {word.foundCount === 1 ? 'hunter has' : 'hunters have'} found it
          </ThemedText>
        </View>
        {found && word.submission?.imageUrl ? (
          <Image source={word.submission.imageUrl} style={styles.thumb} contentFit="cover" />
        ) : null}
      </View>

      <View style={[styles.footer, { borderTopColor: theme.border }]}>
        {busy ? (
          <ActivityIndicator color={accent} />
        ) : found && word.submission ? (
          <ThemedText type="smallBold" style={{ color: theme.success }}>
            ✓ Found · +{word.submission.points} pts
            {word.submission.rank ? ` · ${ordinal(word.submission.rank)} finder` : ''}
          </ThemedText>
        ) : (
          <ThemedText type="smallBold" style={{ color: accent }}>
            Tap to start hunting →
          </ThemedText>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 2,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pill: {
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: 2,
    borderRadius: 999,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  wordCol: {
    flex: 1,
    gap: Spacing.one,
  },
  word: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: 800,
    letterSpacing: 1.5,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.two,
    minHeight: 30,
    justifyContent: 'center',
  },
});
