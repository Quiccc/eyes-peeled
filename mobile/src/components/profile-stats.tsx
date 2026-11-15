import { StyleSheet, View } from 'react-native';

import type { UserProfile } from '@/api/types';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Month points, global rank and streak as three chunky tiles. */
export function ProfileStats({ profile }: { profile: UserProfile }) {
  const theme = useTheme();
  const stats = [
    { label: 'pts this month', value: profile.monthPoints.toLocaleString(), color: theme.text },
    { label: 'global rank', value: profile.monthRank ? `#${profile.monthRank}` : '—', color: theme.text },
    {
      label: 'streak',
      value: `${profile.streak} ${profile.streak === 1 ? 'day' : 'days'}`,
      color: profile.streak > 0 ? theme.successText : theme.text,
    },
  ];
  return (
    <View style={styles.row}>
      {stats.map((s) => (
        <View
          key={s.label}
          accessible
          accessibilityLabel={`${s.value} ${s.label}`}
          style={[styles.tile, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <ThemedText type="subtitle" style={[styles.value, { color: s.color }]} numberOfLines={1} adjustsFontSizeToFit>
            {s.value}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
            {s.label}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.two + 4,
  },
  tile: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: Spacing.two + 4,
    paddingHorizontal: Spacing.two,
    borderRadius: 18,
    borderWidth: 2,
    borderBottomWidth: 5,
  },
  value: {
    fontVariant: ['tabular-nums'],
  },
  label: {
    textAlign: 'center',
  },
});
