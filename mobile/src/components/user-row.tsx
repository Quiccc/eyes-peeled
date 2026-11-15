import { Link } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { User } from '@/api/types';
import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { displayName } from '@/lib/format';

type Props = {
  user: User;
  /** Left-hand rank chip (leaderboards). Top three sit on gold, silver and bronze. */
  rank?: number;
  right?: ReactNode;
  /** The signed-in user's own row: soft orange with an orange edge. */
  highlight?: boolean;
  /** Disable navigation to the profile (e.g. the signed-in user's own row) */
  noLink?: boolean;
  /** Replace the name with this label (e.g. "You"). */
  label?: string;
};

/** A user as a chunky card row: rank, avatar, name, and something on the right. */
export function UserRow({ user, rank, right, highlight, noLink, label }: Props) {
  const theme = useTheme();
  const medal = rank !== undefined && rank <= 3 ? [theme.gold, theme.silver, theme.bronze][rank - 1] : null;

  const content = (
    <Pressable
      disabled={noLink}
      accessibilityRole={noLink ? undefined : 'link'}
      // A plain object, not a style function: <Link asChild> merges styles by spreading and drops functions.
      style={StyleSheet.flatten([
        styles.row,
        {
          backgroundColor: highlight ? theme.backgroundSelected : theme.backgroundElement,
          borderColor: highlight ? theme.tint : theme.border,
          borderBottomWidth: highlight ? 5 : 4,
        },
      ])}>
      {rank !== undefined && (
        <View
          style={[
            styles.rank,
            rank > 99 && styles.rankWide,
            medal ? { backgroundColor: medal } : highlight ? { backgroundColor: theme.backgroundElement } : null,
          ]}>
          <ThemedText
            type={rank > 99 ? 'smallBold' : 'default'}
            style={[styles.rankText, { color: medal ? theme.onMedal : highlight ? theme.text : theme.textSecondary }]}>
            {rank}
          </ThemedText>
        </View>
      )}
      {!label && <Avatar user={user} size={36} />}
      <View style={styles.text}>
        <ThemedText style={styles.name} numberOfLines={1}>
          {label ?? displayName(user)}
        </ThemedText>
      </View>
      {right}
    </Pressable>
  );

  if (noLink) return content;
  return (
    <Link href={{ pathname: '/user/[userId]', params: { userId: user.id } }} asChild>
      {content}
    </Link>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 4,
    minHeight: 56,
    paddingHorizontal: Spacing.two + 4,
    paddingVertical: Spacing.two,
    borderRadius: 18,
    borderWidth: 2,
  },
  rank: {
    minWidth: 32,
    height: 32,
    paddingHorizontal: 4,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankWide: {
    minWidth: 44,
  },
  rankText: {
    fontWeight: 900,
    fontVariant: ['tabular-nums'],
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontWeight: 900,
  },
});
