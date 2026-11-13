import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import type { DailyWord } from '@/api/types';
import { Button } from '@/components/button';
import { Chunky } from '@/components/chunky';
import { Icon } from '@/components/icon';
import { DifficultyPill } from '@/components/pill';
import { ThemedText } from '@/components/themed-text';
import { Edge, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { DIFFICULTY_LABEL, ordinal } from '@/lib/format';

type Props = {
  word: DailyWord;
  onPress: () => void;
  busy?: boolean;
  /** Shown as a "Share" button once the word is found. */
  onShare?: () => void;
};

/** One of today's words: a card edged in its difficulty color, with a camera button until it's found. */
export function WordCard({ word, onPress, busy, onShare }: Props) {
  const theme = useTheme();
  const accent = theme[word.difficulty];
  const found = word.status === 'found';
  const sub = word.submission;

  return (
    <Chunky
      color={theme.backgroundElement}
      edgeColor={accent}
      outlined
      radius={Radius.lg}
      edge={Edge.card}
      contentStyle={styles.card}>
      <View style={styles.info}>
        <View style={styles.header}>
          <DifficultyPill difficulty={word.difficulty} />
          <ThemedText type="small" themeColor="textSecondary">
            up to {word.maxPoints} pts
          </ThemedText>
        </View>
        <ThemedText style={styles.word} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>
          {word.word.toUpperCase()}
        </ThemedText>
        {found && sub ? (
          <View style={styles.foundRow}>
            <Icon name="check" size={16} color={theme.successText} />
            <ThemedText type="smallBold" style={[styles.shrink, { color: theme.successText }]} numberOfLines={1}>
              Found · +{sub.points} pts{sub.rank ? ` · ${ordinal(sub.rank)} finder` : ''}
            </ThemedText>
          </View>
        ) : word.status === 'pending' ? (
          <ThemedText type="smallBold" themeColor="textSecondary" numberOfLines={1}>
            Checking your photo…
          </ThemedText>
        ) : (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {word.foundCount === 0
              ? 'Nobody has found it yet'
              : `${word.foundCount.toLocaleString()} ${word.foundCount === 1 ? 'hunter has' : 'hunters have'} found it`}
          </ThemedText>
        )}
      </View>

      {found ? (
        onShare ? (
          <Button
            size="small"
            variant="secondary"
            icon="share"
            title="Share"
            accessibilityLabel={`Share your ${word.word} find`}
            onPress={onShare}
          />
        ) : null
      ) : (
        <Chunky
          color={theme.tint}
          edgeColor={theme.tintEdge}
          radius={18}
          edge={Edge.button}
          disabled={busy}
          onPress={onPress}
          accessibilityLabel={word.status === 'pending' ? `See the result for ${word.word}` : `Hunt for ${word.word}`}
          contentStyle={styles.camera}>
          {busy ? <ActivityIndicator color={theme.onTint} /> : <Icon name="camera" size={26} color={theme.onTint} />}
        </Chunky>
      )}
    </Chunky>
  );
}

/** Teaser for the Premium word (the 4th daily word), shown to free users in place of the real card. */
export function LockedPremiumCard({ onPress }: { onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${DIFFICULTY_LABEL.expert} word, up to 1000 points, locked. Unlock with Premium.`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        styles.locked,
        { backgroundColor: theme.expertBg, borderColor: theme.expert, opacity: pressed ? 0.85 : 1 },
      ]}>
      <View style={[styles.lockTile, { backgroundColor: theme.backgroundElement }]}>
        <Icon name="lock" size={22} color={theme.expertText} />
      </View>
      <View style={styles.info}>
        <ThemedText style={[styles.lockTitle, { color: theme.expertText }]}>{DIFFICULTY_LABEL.expert} word · up to 1000 pts</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          A tougher 4th word every day, and no ads.
        </ThemedText>
      </View>
      <ThemedText type="smallBold" style={{ color: theme.expertText }}>
        Unlock
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 4,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 4,
  },
  info: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  word: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: 900,
    letterSpacing: 1,
  },
  foundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  shrink: {
    flexShrink: 1,
  },
  camera: {
    width: 56,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locked: {
    borderRadius: Radius.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    minHeight: 76,
  },
  lockTile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockTitle: {
    fontWeight: 900,
  },
});
