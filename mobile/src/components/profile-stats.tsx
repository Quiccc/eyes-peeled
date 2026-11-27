import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { UserProfile } from '@/api/types';
import { FlameIcon } from '@/components/hunt-icons';
import { MedalIcon, PointsIcon, StreakIcon } from '@/components/profile-icons';
import { Bone } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { Edge, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useFormat } from '@/lib/format';

/**
 * Month points, global rank and streak as three chunky tiles (the signed-in user's profile).
 * `strip`: one card of four cells, adding finds all time (another hunter's profile).
 * `loading`: placeholder tiles while `profile` is still on its way.
 */
export function ProfileStats({ profile, strip, loading }: { profile?: UserProfile; strip?: boolean; loading?: boolean }) {
  const fmt = useFormat();
  const { t } = useTranslation();
  const theme = useTheme();
  if (strip) {
    if (!profile) return null;
    const cells = [
      { label: t('stats.monthPoints'), value: fmt.formatNumber(profile.monthPoints), color: theme.scoreNumber, flame: false },
      { label: t('stats.globalRank'), value: profile.monthRank ? `#${profile.monthRank}` : '—', color: theme.text, flame: false },
      { label: t('stats.dayStreak'), value: String(profile.streak), color: theme.text, flame: true },
      { label: t('stats.findsAllTime'), value: fmt.formatNumber(profile.totalFinds), color: theme.text, flame: false },
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
  return <StatTiles profile={profile} loading={loading} />;
}

/**
 * The signed-in user's three tiles: points (in the score colours), rank and streak, each with a glyph.
 * While loading (`profile` undefined, `loading`) the tiles keep their exact shape: the real labels show and
 * each value is a pulsing bone the size of a sample value, so nothing moves when the numbers arrive.
 * Without data and not loading (the request failed), the values read "—".
 */
function StatTiles({ profile, loading }: { profile?: UserProfile; loading?: boolean }) {
  const fmt = useFormat();
  const { t } = useTranslation();
  const theme = useTheme();
  const streak = profile?.streak ?? 0;
  const stats = [
    {
      label: t('stats.monthPoints'),
      value: profile ? fmt.formatNumber(profile.monthPoints) : '—',
      sample: '000',
      color: theme.scoreNumber,
      glyph: <PointsIcon />,
      tile: { backgroundColor: theme.scoreFace, borderColor: theme.scoreDivider, borderBottomColor: theme.scoreEdge },
    },
    {
      label: t('stats.globalRank'),
      value: profile?.monthRank ? `#${profile.monthRank}` : '—',
      sample: '#00',
      color: theme.text,
      glyph: <MedalIcon />,
      tile: { backgroundColor: theme.backgroundElement, borderColor: theme.border },
    },
    {
      label: t('stats.streak'),
      value: profile ? t('stats.days', { count: streak }) : '—',
      sample: t('stats.days', { count: 0 }),
      color: theme.text,
      glyph: <StreakIcon lit={streak > 0} />,
      tile: { backgroundColor: theme.backgroundElement, borderColor: theme.border },
    },
  ];
  const waiting = !profile && loading;
  return (
    <View style={styles.row} accessible={waiting} accessibilityLabel={waiting ? t('stats.loading') : undefined}>
      {stats.map((s) => {
        const value = (
          <View style={styles.valueRow}>
            {s.glyph}
            <ThemedText type="subtitle" style={[styles.value, styles.shrink, { color: s.color }]} numberOfLines={1} adjustsFontSizeToFit>
              {waiting ? s.sample : s.value}
            </ThemedText>
          </View>
        );
        return (
          <View
            key={s.label}
            accessible={!waiting}
            accessibilityLabel={`${s.value} ${s.label}`}
            style={[styles.tile, s.tile]}>
            {waiting ? <Bone style={styles.bone}>{value}</Bone> : value}
            <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
              {s.label}
            </ThemedText>
          </View>
        );
      })}
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
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '100%',
  },
  shrink: {
    flexShrink: 1,
  },
  bone: {
    maxWidth: '100%',
  },
  label: {
    textAlign: 'center',
  },
});
