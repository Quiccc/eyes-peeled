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
  /** Left-hand rank number (leaderboards) */
  rank?: number;
  subtitle?: string;
  right?: ReactNode;
  highlight?: boolean;
  /** Disable navigation to the profile (e.g. the signed-in user's own row) */
  noLink?: boolean;
};

export function UserRow({ user, rank, subtitle, right, highlight, noLink }: Props) {
  const theme = useTheme();
  const content = (
    <Pressable
      disabled={noLink}
      style={[styles.row, highlight && { backgroundColor: theme.backgroundSelected }]}>
      {rank !== undefined && (
        <ThemedText type="smallBold" style={styles.rank} themeColor={rank <= 3 ? 'text' : 'textSecondary'}>
          {rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : rank}
        </ThemedText>
      )}
      <Avatar user={user} size={36} />
      <View style={styles.text}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {displayName(user)}
        </ThemedText>
        {subtitle ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {subtitle}
          </ThemedText>
        ) : null}
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
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    borderRadius: 14,
  },
  rank: {
    width: 28,
    textAlign: 'center',
  },
  text: {
    flex: 1,
  },
});
