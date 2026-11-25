import { StyleSheet, View } from 'react-native';

import { useMyProfile } from '@/api/queries';
import { EyesPeeledLogo } from '@/components/eyes-peeled-logo';
import { FlameIcon } from '@/components/hunt-icons';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { MAX_FONT_SCALE } from '@/features/today/layout';
import { useTheme } from '@/hooks/use-theme';

/** The app icon, "Today's hunt" and the streak pill. The pill is always drawn so nothing moves when the streak loads. */
export function TodayHeader() {
  const theme = useTheme();
  const streak = useMyProfile().data?.streak;

  return (
    <View style={styles.row}>
      <View style={styles.title}>
        <EyesPeeledLogo size={40} edge={3} />
        <ThemedText
          type="title"
          accessibilityRole="header"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          style={styles.shrink}>
          Today&apos;s hunt
        </ThemedText>
      </View>
      <View
        accessible
        accessibilityLabel={streak === undefined ? 'Streak' : `${streak} day streak`}
        style={[styles.streak, { backgroundColor: theme.backgroundElement, borderColor: theme.streakEdge }]}>
        <FlameIcon size={18} />
        <ThemedText style={styles.streakText} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {streak ?? '–'}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  title: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 4,
  },
  shrink: {
    flexShrink: 1,
  },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    // Wide enough for a 3-digit streak, so the pill doesn't grow when the streak loads in.
    minWidth: 80,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two + 4,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
    borderWidth: 2,
    borderBottomWidth: 4,
  },
  streakText: {
    fontWeight: 900,
    fontVariant: ['tabular-nums'],
  },
});
