import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePremiumOffer } from '@/api/queries';
import type { Difficulty } from '@/api/types';
import { useAuth } from '@/auth/auth-provider';
import { Button } from '@/components/button';
import { CloseButton } from '@/components/close-button';
import { HeroBadge } from '@/components/hero-badge';
import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { difficultyColors, Edge, Spacing } from '@/constants/theme';
import { usePremiumPurchase } from '@/features/premium/use-premium-purchase';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/format';

type Benefit = { icon: IconName; hue: Difficulty; title: string; body: string };

const BENEFITS: readonly Benefit[] = [
  { icon: 'no-ads', hue: 'medium', title: 'No ads', body: 'Hunt without interruptions, forever.' },
  { icon: 'trophy', hue: 'expert', title: 'Daily Premium word', body: 'A tougher 4th word every day, worth up to 1000 points.' },
  { icon: 'check', hue: 'easy', title: 'Pay once', body: 'No subscription. Restores on any device.' },
];

export default function PremiumScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { user } = useAuth();
  const offer = usePremiumOffer();
  const { busy, buy, restore } = usePremiumPurchase({ onPremium: () => router.back() });
  const price = offer.data?.priceString;

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex}>
        <View style={styles.topBar}>
          <CloseButton onPress={() => router.back()} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.hero}>
            <HeroBadge icon="star" size="medium" style={styles.badge} />
            <ThemedText type="title" style={[styles.center, styles.title]} accessibilityRole="header">
              Eyes Peeled Premium
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.center}>
              No ads and a 4th daily word, in a single purchase.
            </ThemedText>
          </View>

          <View style={styles.benefits}>
            {BENEFITS.map((b) => (
              <BenefitRow key={b.title} benefit={b} />
            ))}
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
                  onPress={() => offer.data && buy(offer.data)}
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

function BenefitRow({ benefit }: { benefit: Benefit }) {
  const theme = useTheme();
  const c = difficultyColors(theme, benefit.hue);
  return (
    <View style={[styles.benefit, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <View style={[styles.tile, { backgroundColor: c.bg }]}>
        <Icon name={benefit.icon} size={26} color={c.text} />
      </View>
      <View style={styles.benefitText}>
        <ThemedText style={styles.benefitTitle}>{benefit.title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {benefit.body}
        </ThemedText>
      </View>
    </View>
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
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.four,
  },
  hero: {
    alignItems: 'center',
    gap: Spacing.two + 4,
  },
  badge: {
    marginBottom: Spacing.two + 4,
  },
  center: {
    textAlign: 'center',
  },
  title: {
    lineHeight: 38,
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
    paddingBottom: Spacing.four,
    gap: Spacing.two,
  },
});
