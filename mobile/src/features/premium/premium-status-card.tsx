import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Chunky } from '@/components/chunky';
import { Icon } from '@/components/icon';
import { MemberBadge, UpsellMascot } from '@/components/illustrations/premium-art';
import { ThemedText } from '@/components/themed-text';
import { Edge, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** The mascot's size on the upsell card, and how far it hangs below the card's bottom edge (clipped). */
const MASCOT = 96;
const MASCOT_DROP = 22;

/**
 * On the profile: the orange upsell that opens the Premium screen, with the crowned mascot peeking up from
 * its corner, or, once bought, a purple "Premium member" card.
 */
export function PremiumStatusCard({ isPremium }: { isPremium: boolean }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();

  if (isPremium) {
    return (
      <View
        accessible
        accessibilityLabel={`${t('profile.premiumMember')}. ${t('premium.memberPerks')}`}
        style={[styles.member, { backgroundColor: theme.expertFace, borderColor: theme.expert, borderBottomColor: theme.expertEdge }]}>
        <MemberBadge />
        <View style={styles.text}>
          <ThemedText style={styles.title}>{t('profile.premiumMember')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('premium.memberPerks')}
          </ThemedText>
        </View>
      </View>
    );
  }

  return (
    <Chunky
      color={theme.tint}
      edgeColor={theme.tintEdge}
      radius={20}
      accessibilityRole="link"
      accessibilityLabel={`${t('premium.upsellTitle')}. ${t('premium.upsellBody')}`}
      onPress={() => router.push('/premium')}
      contentStyle={styles.upsell}>
      <View style={styles.upsellText}>
        <View style={styles.titleRow}>
          <ThemedText style={[styles.title, styles.shrink, { color: theme.onTint }]}>
            {t('premium.upsellTitle')}
          </ThemedText>
          <Icon name="chevron-right" size={18} color={theme.onTint} />
        </View>
        <ThemedText type="small" style={{ color: theme.onTint }}>
          {t('premium.upsellBody')}
        </ThemedText>
      </View>
      <View style={styles.mascot} pointerEvents="none">
        <UpsellMascot size={MASCOT} />
      </View>
    </Chunky>
  );
}

const styles = StyleSheet.create({
  member: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: Spacing.three,
    borderRadius: 20,
    borderWidth: 2,
    borderBottomWidth: Edge.button,
  },
  upsell: {
    minHeight: 100,
    justifyContent: 'center',
    // Room on the right for the mascot; the text wraps beside it at large font sizes.
    paddingLeft: Spacing.three,
    paddingRight: MASCOT + 8,
    paddingVertical: Spacing.three,
    overflow: 'hidden',
  },
  text: {
    flex: 1,
    gap: 2,
  },
  upsellText: {
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  shrink: {
    flexShrink: 1,
  },
  title: {
    fontWeight: 900,
  },
  mascot: {
    position: 'absolute',
    right: 4,
    bottom: -MASCOT_DROP,
  },
});
