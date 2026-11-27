import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import type { LeaderboardEntry } from '@/api/types';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { HuntCameraIcon } from '@/components/tab-icons';
import { ThemedText } from '@/components/themed-text';
import { Edge, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useFormat } from '@/lib/format';

type RowProps = {
  entry: LeaderboardEntry;
  /** The signed-in player's own row: soft orange, "You", not a link. */
  mine?: boolean;
  /** Ends of the grouped card: the first row rounds the top, the last rounds the bottom and carries the edge. */
  first?: boolean;
  last?: boolean;
};

/** Height of a row below the podium (the last one adds its bottom edge). */
export const RANK_ROW_HEIGHT = 56;

/** One leaderboard place below the podium, as a slice of one grouped card. */
export function RankRow({ entry, mine, first, last }: RowProps) {
  const fmt = useFormat();
  const { t } = useTranslation();
  const theme = useTheme();
  const name = mine ? t('common.you') : fmt.displayName(entry.user);
  const row = (
    <Pressable
      disabled={mine}
      accessibilityRole={mine ? undefined : 'link'}
      accessibilityLabel={t('leaderboard.rowA11y', { rank: entry.rank, name, count: entry.points, points: fmt.formatNumber(entry.points) })}
      // A plain object, not a style function: <Link asChild> merges styles by spreading and drops functions.
      style={StyleSheet.flatten([
        styles.row,
        {
          backgroundColor: mine ? theme.backgroundSelected : theme.backgroundElement,
          borderColor: theme.border,
          borderTopWidth: first ? 2 : 0,
          borderBottomWidth: last ? Edge.card : 0,
        },
        first && styles.first,
        last && styles.last,
      ])}>
      {!first && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
      <ThemedText style={[styles.rank, { color: theme.textSecondary }]}>{entry.rank}</ThemedText>
      <Avatar user={entry.user} size={36} />
      <ThemedText style={styles.name} numberOfLines={1}>
        {name}
      </ThemedText>
      <ThemedText style={styles.points}>{fmt.formatNumber(entry.points)}</ThemedText>
    </Pressable>
  );
  if (mine) return row;
  return (
    <Link href={{ pathname: '/user/[userId]', params: { userId: entry.user.id } }} asChild>
      {row}
    </Link>
  );
}

/**
 * The signed-in player's place, pinned above the tab bar, with how far it is to the next spot.
 * Tapping it jumps the list to their row; `busy` while pages are still loading to get there.
 */
export function MyRankBar({
  entry,
  goal,
  onPress,
  busy,
}: {
  entry: LeaderboardEntry;
  goal: string;
  onPress: () => void;
  busy?: boolean;
}) {
  const fmt = useFormat();
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={t('leaderboard.myRankA11y', { rank: entry.rank, count: entry.points, points: fmt.formatNumber(entry.points), goal })}
      accessibilityHint={t('leaderboard.myRankHint')}
      accessibilityState={{ busy }}
      style={({ pressed }) => [
        styles.me,
        { backgroundColor: theme.backgroundSelected, borderColor: theme.tint, opacity: pressed ? 0.8 : 1 },
      ]}>
      <View style={[styles.meRank, { backgroundColor: theme.backgroundElement }]}>
        {busy ? (
          <ActivityIndicator size="small" color={theme.text} />
        ) : (
          <ThemedText style={styles.meRankText}>#{entry.rank}</ThemedText>
        )}
      </View>
      <Avatar user={entry.user} size={40} />
      <View style={styles.meText}>
        <ThemedText style={styles.name}>{t('common.you')}</ThemedText>
        <View style={styles.goal}>
          <Icon name="arrow-up" size={13} color={theme.tabSelected} />
          <ThemedText type="small" numberOfLines={1} style={[styles.goalText, { color: theme.tabSelected }]}>
            {goal}
          </ThemedText>
        </View>
      </View>
      <ThemedText type="subtitle" style={[styles.mePoints, { color: theme.scoreNumber }]}>
        {fmt.formatNumber(entry.points)}
      </ThemedText>
    </Pressable>
  );
}

/** Shown in the pinned spot when the player has no points this month. */
export function UnrankedBar({ onHunt }: { onHunt: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View style={[styles.me, styles.unranked, { backgroundColor: theme.backgroundSelected, borderColor: theme.tint }]}>
      <View style={styles.meText}>
        <ThemedText style={styles.name}>{t('leaderboard.unrankedTitle')}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t('leaderboard.unrankedHint')}
        </ThemedText>
      </View>
      <Button size="small" iconNode={<HuntCameraIcon size={16} />} title={t('leaderboard.hunt')} onPress={onHunt} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    height: RANK_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 4,
    paddingLeft: 10,
    paddingRight: Spacing.three,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    overflow: 'hidden',
  },
  first: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
  },
  last: {
    height: RANK_ROW_HEIGHT + Edge.card,
    borderBottomLeftRadius: Radius.lg,
    borderBottomRightRadius: Radius.lg,
  },
  divider: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  rank: {
    width: 28,
    textAlign: 'center',
    fontWeight: 900,
    fontVariant: ['tabular-nums'],
  },
  name: {
    flex: 1,
    minWidth: 0,
    fontWeight: 900,
  },
  points: {
    fontWeight: 900,
    fontVariant: ['tabular-nums'],
  },
  me: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 4,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 2,
    borderBottomWidth: Edge.button,
  },
  unranked: {
    borderStyle: 'dashed',
    borderBottomWidth: 2,
    paddingRight: 10,
  },
  meRank: {
    minWidth: 40,
    height: 32,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meRankText: {
    fontWeight: 900,
    fontVariant: ['tabular-nums'],
  },
  meText: {
    flex: 1,
    minWidth: 0,
  },
  goal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  goalText: {
    flexShrink: 1,
  },
  mePoints: {
    fontVariant: ['tabular-nums'],
  },
});
