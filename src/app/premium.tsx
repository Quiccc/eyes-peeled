import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Difficulty } from '@/api/types';
import { useAuth } from '@/auth/auth-provider';
import { Button } from '@/components/button';
import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { difficultyColors, Edge, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/format';
import { queryKeys } from '@/lib/query-client';
import { buyPremium, getPremiumOffer, restorePremium } from '@/purchases/purchases';

const BENEFITS: readonly { icon: IconName; hue: Difficulty; title: string; body: string }[] = [
  { icon: 'no-ads', hue: 'medium', title: 'No ads', body: 'Hunt without interruptions, forever.' },
  { icon: 'trophy', hue: 'expert', title: 'Daily Premium word', body: 'A tougher 4th word every day, worth up to 1000 points.' },
  { icon: 'check', hue: 'easy', title: 'Pay once', body: 'No subscription. Restores on any device.' },
];

export default function PremiumScreen() {
  const router = useRouter();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { user, updateUser } = useAuth();
  const offer = useQuery({ queryKey: ['premium', 'offer'], queryFn: getPremiumOffer, staleTime: Infinity });
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);

  const finish = async (updated: Parameters<typeof updateUser>[0]) => {
    updateUser(updated);
    await queryClient.invalidateQueries({ queryKey: queryKeys.daily });
    if (updated.isPremium) {
      router.back();
    } else {
      Alert.alert('Nothing to restore', 'No Premium purchase was found for this store account.');
    }
  };

  const buy = async () => {
    if (!offer.data) return;
    setBusy('buy');
    try {
      const result = await buyPremium(offer.data);
      if (result !== 'cancelled') await finish(result);
    } catch (e) {
      Alert.alert('Purchase failed', errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    setBusy('restore');
    try {
      await finish(await restorePremium());
    } catch (e) {
      Alert.alert('Could not restore purchases', errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const price = offer.data?.priceString;

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.close,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
            ]}>
            <Icon name="close" size={20} color={theme.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.hero}>
            <View style={[styles.badge, { backgroundColor: theme.tint, borderBottomColor: theme.tintEdge }]}>
              <Icon name="star" size={52} color={theme.onTint} />
            </View>
            <ThemedText type="title" style={styles.center} accessibilityRole="header">
              Word Hunt Premium
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.center}>
              No ads and a 4th daily word, in a single purchase.
            </ThemedText>
          </View>

          <View style={styles.benefits}>
            {BENEFITS.map((b) => {
              const c = difficultyColors(theme, b.hue);
              return (
                <View
                  key={b.title}
                  style={[styles.benefit, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                  <View style={[styles.tile, { backgroundColor: c.bg }]}>
                    <Icon name={b.icon} size={26} color={c.text} />
                  </View>
                  <View style={styles.benefitText}>
                    <ThemedText style={styles.benefitTitle}>{b.title}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {b.body}
                    </ThemedText>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>

        <View style={styles.actions}>
          {user?.isPremium ? (
            <ThemedText type="smallBold" style={[styles.center, { color: theme.successText }]}>
              You already have Premium.
            </ThemedText>
          ) : (
            <>
              {offer.error ? (
                <>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                    {errorMessage(offer.error)}
                  </ThemedText>
                  <Button title="Try again" variant="secondary" onPress={() => offer.refetch()} />
                </>
              ) : (
                <Button
                  title={price ? `Get Premium · ${price}` : 'Get Premium'}
                  height={56}
                  loading={offer.isPending || busy === 'buy'}
                  disabled={busy !== null}
                  onPress={buy}
                />
              )}
              <Button
                title="Restore purchases"
                variant="ghost"
                loading={busy === 'restore'}
                disabled={busy !== null}
                onPress={restore}
              />
            </>
          )}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  close: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 2,
    borderBottomWidth: Edge.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    gap: Spacing.four,
  },
  hero: {
    alignItems: 'center',
    gap: Spacing.two + 4,
  },
  badge: {
    width: 96,
    height: 96,
    borderRadius: 32,
    borderBottomWidth: 8,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-6deg' }],
    marginBottom: Spacing.two + 4,
  },
  center: {
    textAlign: 'center',
  },
  benefits: {
    gap: Spacing.two + 4,
  },
  benefit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 4,
    padding: Spacing.two + 4,
    borderRadius: 20,
    borderWidth: 2,
    borderBottomWidth: Edge.button,
  },
  tile: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: {
    flex: 1,
    gap: 2,
  },
  benefitTitle: {
    fontWeight: 900,
  },
  actions: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
    gap: Spacing.two,
  },
});
