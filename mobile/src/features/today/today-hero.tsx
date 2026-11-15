import { useQueryClient } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';

import { useMyProfile } from '@/api/queries';
import type { Daily } from '@/api/types';
import { Chunky } from '@/components/chunky';
import { Countdown } from '@/components/countdown';
import { Icon } from '@/components/icon';
import { ProgressBar } from '@/components/progress-bar';
import { ThemedText } from '@/components/themed-text';
import { Edge, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatNumber } from '@/lib/format';
import { queryKeys } from '@/lib/query-client';

/** The orange header card: streak, countdown to new words and today's progress. */
export function TodayHero({ daily }: { daily: Daily | undefined }) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const streak = useMyProfile().data?.streak;

  const words = daily?.words ?? [];
  const found = words.filter((w) => w.status === 'found').length;
  const points = words.reduce((sum, w) => sum + (w.submission?.points ?? 0), 0);
  const ink = { color: theme.onTint };

  return (
    <Chunky color={theme.tint} edgeColor={theme.tintEdge} radius={28} edge={Edge.card} contentStyle={styles.hero}>
      <View style={styles.heroTop}>
        <ThemedText type="title" style={ink} accessibilityRole="header">
          Today&apos;s hunt
        </ThemedText>
        {streak !== undefined && (
          <View style={styles.streak} accessible accessibilityLabel={`${streak} day streak`}>
            <Icon name="flame" size={18} color={theme.onTint} />
            <ThemedText style={[styles.streakText, ink]}>{streak}</ThemedText>
          </View>
        )}
      </View>

      {daily && (
        <>
          <View>
            <Countdown
              type="display"
              style={[ink, styles.countdown]}
              target={daily.nextResetAt}
              onExpire={() => queryClient.invalidateQueries({ queryKey: queryKeys.daily })}
            />
            <View style={styles.inline}>
              <Icon name="clock" size={16} color={theme.onTint} />
              <ThemedText type="small" style={ink}>
                until new words
              </ThemedText>
            </View>
          </View>

          <View style={styles.progressBlock}>
            <View style={styles.progressLabels}>
              <ThemedText type="smallBold" style={ink}>
                {found}/{words.length} found
              </ThemedText>
              <ThemedText type="smallBold" style={ink}>
                {formatNumber(points)} pts today
              </ThemedText>
            </View>
            <ProgressBar
              value={found}
              max={words.length}
              trackColor="rgba(43, 22, 0, 0.25)"
              fillColor={WHITE}
              accessibilityLabel={`${found} of ${words.length} words found`}
            />
          </View>
        </>
      )}
    </Chunky>
  );
}

const WHITE = '#FFFFFF';

const styles = StyleSheet.create({
  hero: {
    padding: 20,
    gap: Spacing.two + 4,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two + 4,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: WHITE,
  },
  streakText: {
    fontWeight: 900,
  },
  countdown: {
    letterSpacing: 1,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressBlock: {
    gap: 6,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
