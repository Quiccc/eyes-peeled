import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
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
import { useFormat } from '@/lib/format';

/** Content column width cap, so tablets and landscape get a phone-width column instead of a stretched one. */
const MAX_WIDTH = 480;
/** The hero artwork's box: the crowned mascot and the error badge both fill it, so the title never moves. */
const HERO = { width: 140, height: 112 };
const ERROR_BADGE_SCALE = 1.47;

/** `id` names the title and body in the catalogs (premium.benefits.<id>). */
type Benefit = { id: 'noAds' | 'premiumWord' | 'payOnce'; glyph: ReactNode; tile: string };

const BENEFITS: readonly Benefit[] = [
  { id: 'noAds', glyph: <NoAdsGlyph />, tile: BENEFIT_TILE.noAds },
  { id: 'premiumWord', glyph: <PremiumWordGlyph />, tile: BENEFIT_TILE.premiumWord },
  { id: 'payOnce', glyph: <PayOnceGlyph />, tile: BENEFIT_TILE.payOnce },
];

/**
 * The Premium offer. States: the offer (price loading, ready or failed), "you already have Premium", and,
 * right after buying or restoring here, a welcome screen pointing to Today's new Premium word.
 * The hero box and the 56px main button keep their size in every state, so loading the price shifts nothing.
 */
export default function PremiumScreen() {
  const fmt = useFormat();
  const { t } = useTranslation();
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
                {t('premium.welcomeTitle')}
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.center}>
                {t('premium.welcomeBody')}
              </ThemedText>
              <View style={styles.perks}>
                {[t('premium.perkNoAds'), t('premium.perkWordUnlocked')].map((perk) => (
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
              <Button title={t('premium.goToToday')} height={56} onPress={() => router.dismissTo('/')} />
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
                {t('premium.title')}
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.center}>
                {t('premium.subtitle')}
              </ThemedText>
            </View>

            <View style={styles.benefits}>
              {BENEFITS.map((b) => (
                <BenefitRow key={b.id} benefit={b} />
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
                  accessibilityLabel={`${t('premium.ownedTitle')}. ${t('premium.ownedBody')}`}
                  style={[styles.owned, { backgroundColor: theme.easyBg }]}>
                  <View style={[styles.ownedCheck, { backgroundColor: theme.success }]}>
                    <Icon name="check" size={18} color="#FFFFFF" />
                  </View>
                  <View style={styles.ownedText}>
                    <ThemedText style={[styles.bold, { color: theme.easyText }]}>{t('premium.ownedTitle')}</ThemedText>
                    <ThemedText type="small" style={{ color: theme.easyText }}>
                      {t('premium.ownedBody')}
                    </ThemedText>
                  </View>
                </View>
                <Button title={t('common.done')} height={56} onPress={() => router.back()} />
              </>
            ) : (
              <>
                {failed ? (
                  <>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.center} accessibilityRole="alert">
                      {fmt.errorMessage(offer.error)}
                    </ThemedText>
                    <Button title={t('common.tryAgain')} icon="retry" variant="secondary" height={56} onPress={() => offer.refetch()} />
                  </>
                ) : (
                  <Button
                    title={price ? t('premium.buyWithPrice', { price }) : t('premium.buy')}
                    height={56}
                    loading={offer.isPending || busy === 'buy'}
                    disabled={busy !== null}
                    onPress={() => offer.data && buy(offer.data)}
                  />
                )}
                <Button
                  title={t('profile.restorePurchases')}
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
  const { t } = useTranslation();
  const theme = useTheme();
  const title = t(`premium.benefits.${benefit.id}.title`);
  const body = t(`premium.benefits.${benefit.id}.body`);
  return (
    <View
      accessible
      accessibilityLabel={`${title}. ${body}`}
      style={[styles.benefit, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <View style={[styles.tile, { backgroundColor: benefit.tile }]}>{benefit.glyph}</View>
      <View style={styles.benefitText}>
        <ThemedText style={styles.bold}>{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {body}
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
