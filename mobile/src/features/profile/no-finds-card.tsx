import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useDaily } from '@/api/queries';
import { Button } from '@/components/button';
import { SleepyEyeArt } from '@/components/illustrations/premium-art';
import { HuntCameraIcon } from '@/components/tab-icons';
import { ThemedText } from '@/components/themed-text';
import { Edge, Radius, Spacing } from '@/constants/theme';
import { useStartHunt } from '@/features/hunt/use-start-hunt';
import { useTheme } from '@/hooks/use-theme';

/**
 * "Your finds today" with nothing in it yet: the sleepy mascot looking around, and a button that opens the
 * camera for the next word still to find (the same as the tab bar's shutter), or Today if words haven't loaded.
 */
export function NoFindsCard({ style }: { style?: StyleProp<ViewStyle> }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { data: daily } = useDaily();
  const { openingId, startHunt } = useStartHunt();
  const next = daily?.words.find((w) => w.status !== 'found');

  const onStart = () => {
    if (next) void startHunt(next);
    else router.navigate('/');
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }, style]}>
      <SleepyEyeArt size={84} />
      <View style={styles.copy}>
        <ThemedText style={[styles.center, styles.title]}>{t('friends.feedEmptyTitle')}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          {t('profile.noFindsHint')}
        </ThemedText>
      </View>
      <Button
        title={t('leaderboard.startHunting')}
        variant="secondary"
        iconNode={<HuntCameraIcon size={22} />}
        loading={openingId !== null}
        onPress={onStart}
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // At the default text size this card is shorter than the loading placeholder (FeedCardSkeleton), and is
  // stretched to its height, centred, so nothing below it moves when the finds arrive.
  card: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: 2,
    borderBottomWidth: Edge.button,
  },
  copy: {
    gap: Spacing.one,
  },
  title: {
    fontWeight: 900,
  },
  center: {
    textAlign: 'center',
  },
  button: {
    alignSelf: 'stretch',
  },
});
