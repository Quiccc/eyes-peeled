import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { Daily, Difficulty } from '@/api/types';
import { Countdown } from '@/components/countdown';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { MAX_FONT_SCALE } from '@/features/today/layout';
import { useTheme } from '@/hooks/use-theme';
import { comboPointsOf } from '@/lib/combo';
import { useFormat } from '@/lib/format';
import { queryKeys } from '@/lib/query-client';

const FREE_SLOTS: Difficulty[] = ['easy', 'medium', 'hard'];
const PREMIUM_SLOTS: Difficulty[] = [...FREE_SLOTS, 'expert'];

type Props = {
  daily: Daily | undefined;
  /** Premium users get a 4th square for the Premium word; free users see it locked. */
  premium: boolean;
};

/**
 * Today's points, a square per word (ticked when found) and the countdown to new words.
 * It keeps the same shape while loading, with placeholders, so the trail below never shifts.
 */
export function TodayScoreboard({ daily, premium }: Props) {
  const fmt = useFormat();
  const { t } = useTranslation();
  const theme = useTheme();
  const queryClient = useQueryClient();

  const words = daily?.words ?? [];
  const found = words.filter((w) => w.status === 'found').length;
  // Finds plus the combo bonuses they earned.
  const points = words.reduce((sum, w) => sum + (w.submission?.points ?? 0), 0) + comboPointsOf(words);
  const slots = premium ? PREMIUM_SLOTS : FREE_SLOTS;
  const total = daily ? words.length : slots.length;
  const summary = premium ? t('today.summary', { found, count: total }) : t('today.summaryLocked', { found, count: total });

  return (
    <View style={[styles.card, { backgroundColor: theme.scoreFace, borderColor: theme.scoreEdge }]}>
      <View style={styles.top}>
        <View style={styles.points}>
          <ThemedText
            type="display"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            maxFontSizeMultiplier={MAX_FONT_SCALE}
            style={[styles.shrink, { color: theme.scoreNumber }]}>
            {daily ? fmt.formatNumber(points) : '–'}
          </ThemedText>
          <ThemedText themeColor="textSecondary" numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {t('today.ptsToday')}
          </ThemedText>
        </View>

        <View style={styles.found}>
          <View style={styles.squares} accessible accessibilityRole="image" accessibilityLabel={summary}>
            {slots.map((difficulty) => {
              const done = words.some((w) => w.difficulty === difficulty && w.status === 'found');
              return (
                <View
                  key={difficulty}
                  style={[
                    styles.square,
                    done
                      ? { backgroundColor: theme.easyBg, borderColor: theme.easy }
                      : { backgroundColor: theme.scoreFace, borderColor: theme[difficulty] },
                  ]}>
                  {done && <Icon name="check" size={16} color={theme.easyText} />}
                </View>
              );
            })}
            {!premium && (
              <View style={[styles.square, styles.lockedSquare, { backgroundColor: theme.expertBg, borderColor: theme.expert }]}>
                <Icon name="lock" size={14} color={theme.expertText} />
              </View>
            )}
          </View>
          <ThemedText type="smallBold" numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE} importantForAccessibility="no">
            {daily ? t('today.foundOf', { found, total }) : ' '}
          </ThemedText>
        </View>
      </View>

      <View style={[styles.countdownRow, { borderTopColor: theme.scoreDivider }]}>
        <Icon name="clock" size={16} color={theme.textSecondary} />
        {daily ? (
          <Countdown
            type="small"
            themeColor="textSecondary"
            style={styles.tabular}
            maxFontSizeMultiplier={MAX_FONT_SCALE}
            target={daily.nextResetAt}
            onExpire={() => queryClient.invalidateQueries({ queryKey: queryKeys.daily })}
          />
        ) : (
          <ThemedText type="small" themeColor="textSecondary" style={styles.tabular} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            --:--:--
          </ThemedText>
        )}
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {t('today.untilNewWords')}
        </ThemedText>
      </View>
    </View>
  );
}

const SQUARE = 28;

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: Spacing.two + 2,
    borderRadius: 28,
    borderWidth: 2,
    borderBottomWidth: 6,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  points: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  shrink: {
    flexShrink: 1,
  },
  found: {
    alignItems: 'flex-end',
    gap: 6,
  },
  squares: {
    flexDirection: 'row',
    gap: 6,
  },
  square: {
    width: SQUARE,
    height: SQUARE,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedSquare: {
    borderStyle: 'dashed',
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: Spacing.two + 2,
    borderTopWidth: 2,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
});
