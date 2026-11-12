import { StyleSheet, View } from 'react-native';

import type { UserProfile } from '@/api/types';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function ProfileStats({ profile }: { profile: UserProfile }) {
  const theme = useTheme();
  const stats = [
    { label: 'Month pts', value: profile.monthPoints.toLocaleString() },
    { label: 'Rank', value: profile.monthRank ? `#${profile.monthRank}` : '—' },
    { label: 'Streak', value: `${profile.streak}🔥` },
    { label: 'Finds', value: String(profile.totalFinds) },
  ];
  return (
    <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
      {stats.map((s) => (
        <View key={s.label} style={styles.stat}>
          <ThemedText style={styles.value}>{s.value}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
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
    borderRadius: 18,
    paddingVertical: Spacing.three,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  value: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: 800,
  },
});
