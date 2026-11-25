import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePremiumOffer } from '@/api/queries';
import { useAuth } from '@/auth/auth-provider';
import { Button } from '@/components/button';
import { CloseButton } from '@/components/close-button';
import { Icon } from '@/components/icon';
import { BADGE_HEIGHT, BADGE_WIDTH, DizzyBadge } from '@/components/illustrations/hunt-art';
import {
  BENEFIT_TILE,
  NoAdsGlyph,
  PayOnceGlyph,
  PremiumHeroArt,
  PremiumWelcomeArt,
  PremiumWordGlyph,
} from '@/components/illustrations/premium-art';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Edge, Radius, Spacing } from '@/constants/theme';
import { usePremiumPurchase } from '@/features/premium/use-premium-purchase';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/format';

/** Content column width cap, so tablets and landscape get a phone-width column instead of a stretched one. */
const MAX_WIDTH = 480;
/** The hero artwork's box: the crowned mascot and the error badge both fill it, so the title never moves. */
const HERO = { width: 140, height: 112 };
const ERROR_BADGE_SCALE = 1.47;

type Benefit = { glyph: ReactNode; tile: string; title: string; body: string };

const BENEFITS: readonly Benefit[] = [
  { glyph: <NoAdsGlyph />, tile: BENEFIT_TILE.noAds, title: 'No ads', body: 'Hunt without interruptions, forever.' },
  {
    glyph: <PremiumWordGlyph />,
    tile: BENEFIT_TILE.premiumWord,
    title: 'Daily Premium word',
    body: 'A tougher 4th word every day, worth up to 1000 points.',
  },
  { glyph: <PayOnceGlyph />, tile: BENEFIT_TILE.payOnce, title: 'Pay once', body: 'No subscription. Restores on any device.' },
];

/**
 * The Premium offer. States: the offer (price loading, ready or failed), "you already have Premium", and,
 * right after buying or restoring here, a welcome screen pointing to Today's new Premium word.
 * The hero box and the 56px main button keep their size in every state, so loading the price shifts nothing.
 */
export default function PremiumScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { user } = useAuth();
  const offer = usePremiumOffer();
  const [welcome, setWelcome] = useState(false);
  const { busy, buy, restore } = usePremiumPurchase({ onPremium: () => setWelcome(true) });
  const price = offer.data?.priceString;

  if (welcome) {
    return (
      <ThemedView style={styles.flex}>
        <SafeAreaView style={styles.flex}>
          <ScrollView contentContainerStyle={styles.scroll} alwaysBounceVertical={false}>
            <View style={[styles.column, styles.welcome]}>
              <PremiumWelcomeArt />
              <ThemedText type="title" style={[styles.center, styles.title]} accessibilityRole="header">
                Welcome to Premium
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.center}>
                Ads are off. Your Premium word is waiting on Today.
              </ThemedText>
              <View style={styles.perks}>
                {['No ads', 'Premium word unlocked'].map((perk) => (
                  <View key={perk} style={[styles.perk, { backgroundColor: theme.easyBg }]}>
                    <Icon name="check" size={16} color={theme.easyText} />
                    <ThemedText type="smallBold" style={{ color: theme.easyText }}>
                      {perk}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
          <View style={styles.actionsWrap}>
            <View style={styles.actions}>
              <Button title="Go to Today" height={56} onPress={() => router.dismissTo('/')} />
            </View>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  // Only when there is no price at all; a failed background refetch keeps the price it had.
  const failed = !user?.isPremium && !offer.data && !!offer.error;

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex}>
        <View style={styles.topBarWrap}>
          <View style={styles.topBar}>
            <CloseButton onPress={() => router.back()} />
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} alwaysBounceVertical={false}>
          <View style={[styles.column, styles.content]}>
            <View style={styles.hero}>
              <View style={styles.heroArt}>{failed ? <ErrorBadge /> : <PremiumHeroArt />}</View>
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
          </View>
        </ScrollView>

        <View style={styles.actionsWrap}>
          <View style={styles.actions}>
            {user?.isPremium ? (
              <>
                <View
                  accessible
                  accessibilityLabel="You have Premium. No ads, and the Premium word is on Today."
                  style={[styles.owned, { backgroundColor: theme.easyBg }]}>
                  <View style={[styles.ownedCheck, { backgroundColor: theme.success }]}>
                    <Icon name="check" size={18} color="#FFFFFF" />
                  </View>
                  <View style={styles.ownedText}>
                    <ThemedText style={[styles.bold, { color: theme.easyText }]}>You have Premium</ThemedText>
                    <ThemedText type="small" style={{ color: theme.easyText }}>
                      No ads, and the Premium word is on Today.
                    </ThemedText>
                  </View>
                </View>
                <Button title="Done" height={56} onPress={() => router.back()} />
              </>
            ) : (
              <>
                {failed ? (
                  <>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.center} accessibilityRole="alert">
                      {errorMessage(offer.error)}
                    </ThemedText>
                    <Button title="Try again" icon="retry" variant="secondary" height={56} onPress={() => offer.refetch()} />
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
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

/** The price couldn't load: the dizzy mascot from "Upload failed", enlarged to fill the hero box. */
function ErrorBadge() {
  return (
    <View style={styles.errorBadge}>
      <DizzyBadge />
    </View>
  );
}

function BenefitRow({ benefit }: { benefit: Benefit }) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${benefit.title}. ${benefit.body}`}
      style={[styles.benefit, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <View style={[styles.tile, { backgroundColor: benefit.tile }]}>{benefit.glyph}</View>
      <View style={styles.benefitText}>
        <ThemedText style={styles.bold}>{benefit.title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {benefit.body}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
  },
  column: {
    width: '100%',
    maxWidth: MAX_WIDTH,
    paddingHorizontal: Spacing.four,
  },
  topBarWrap: {
    alignItems: 'center',
  },
  topBar: {
    width: '100%',
    maxWidth: MAX_WIDTH,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  content: {
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
    gap: Spacing.four,
  },
  hero: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  heroArt: {
    width: HERO.width,
    height: HERO.height,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  errorBadge: {
    width: BADGE_WIDTH,
    height: BADGE_HEIGHT,
    transform: [{ rotate: '10deg' }, { scale: ERROR_BADGE_SCALE }],
  },
  center: {
    textAlign: 'center',
  },
  title: {
    lineHeight: 38,
  },
  benefits: {
    gap: 12,
  },
  benefit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 20,
    borderWidth: 2,
    borderBottomWidth: Edge.button,
  },
  tile: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: {
    flex: 1,
    gap: 2,
  },
  bold: {
    fontWeight: 900,
  },
  actionsWrap: {
    alignItems: 'center',
  },
  actions: {
    width: '100%',
    maxWidth: MAX_WIDTH,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
    gap: Spacing.two,
  },
  owned: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: Spacing.three,
    borderRadius: 18,
  },
  ownedCheck: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownedText: {
    flex: 1,
  },
  welcome: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.four,
  },
  perks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  perk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.one,
    paddingLeft: Spacing.two,
    paddingRight: 12,
    borderRadius: Radius.pill,
  },
});
