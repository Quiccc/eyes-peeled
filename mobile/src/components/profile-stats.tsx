import { StyleSheet, View } from 'react-native';

import type { UserProfile } from '@/api/types';
import { FlameIcon } from '@/components/hunt-icons';
import { ThemedText } from '@/components/themed-text';
import { Edge, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatNumber, plural } from '@/lib/format';

/**
 * Month points, global rank and streak as three chunky tiles.
 * `strip`: one card of four cells, adding finds all time (another hunter's profile).
 */
export function ProfileStats({ profile, strip }: { profile: UserProfile; strip?: boolean }) {
  const theme = useTheme();
  if (strip) {
    const cells = [
      { label: 'pts this month', value: formatNumber(profile.monthPoints), color: theme.scoreNumber, flame: false },
      { label: 'global rank', value: profile.monthRank ? `#${profile.monthRank}` : '—', color: theme.text, flame: false },
      { label: 'day streak', value: String(profile.streak), color: theme.text, flame: true },
      { label: 'finds all time', value: formatNumber(profile.totalFinds), color: theme.text, flame: false },
    ];
    return (
      <View style={[styles.strip, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        {cells.map((s, i) => (
          <View
            key={s.label}
            accessible
            accessibilityLabel={`${s.value} ${s.label}`}
            style={[styles.cell, i > 0 && { borderLeftWidth: 2, borderLeftColor: theme.border }]}>
            <View style={styles.cellValue}>
              {s.flame && <FlameIcon size={17} />}
              <ThemedText type="subtitle" style={[styles.value, { color: s.color }]} numberOfLines={1} adjustsFontSizeToFit>
                {s.value}
              </ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary" style={[styles.label, styles.cellLabel]}>
              {s.label}
            </ThemedText>
          </View>
        ))}
      </View>
    );
  }
  const stats = [
    { label: 'pts this month', value: formatNumber(profile.monthPoints), color: theme.text },
    { label: 'global rank', value: profile.monthRank ? `#${profile.monthRank}` : '—', color: theme.text },
    {
      label: 'streak',
      value: plural(profile.streak, 'day'),
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
  strip: {
    flexDirection: 'row',
    borderRadius: 20,
    borderWidth: 2,
    borderBottomWidth: Edge.button,
    overflow: 'hidden',
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: Spacing.two + 4,
    paddingHorizontal: Spacing.one,
  },
  cellValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    maxWidth: '100%',
  },
  cellLabel: {
    lineHeight: 16,
  },
  value: {
    fontVariant: ['tabular-nums'],
  },
  label: {
    textAlign: 'center',
  },
});
