import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Chunky } from '@/components/chunky';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** On the profile: a green "Premium active" note, or the orange upsell that opens the Premium screen. */
export function PremiumStatusCard({ isPremium }: { isPremium: boolean }) {
  const theme = useTheme();
  const router = useRouter();

  if (isPremium) {
    return (
      <View style={[styles.active, { backgroundColor: theme.easyBg }]}>
        <Icon name="check" size={18} color={theme.easyText} />
        <ThemedText type="smallBold" style={{ color: theme.easyText }}>
          Premium active: no ads, Premium word unlocked
        </ThemedText>
      </View>
    );
  }

  return (
    <Chunky
      color={theme.tint}
      edgeColor={theme.tintEdge}
      radius={20}
      accessibilityRole="link"
      accessibilityLabel="Remove ads and unlock the Premium word. One purchase, yours forever."
      onPress={() => router.push('/premium')}
      contentStyle={styles.upsell}>
      <Icon name="star" size={28} color={theme.onTint} />
      <View style={styles.upsellText}>
        <ThemedText style={[styles.upsellTitle, { color: theme.onTint }]}>Remove ads &amp; unlock the Premium word</ThemedText>
        <ThemedText type="small" style={{ color: theme.onTint }}>
          One purchase, yours forever
        </ThemedText>
      </View>
      <Icon name="chevron-right" size={20} color={theme.onTint} />
    </Chunky>
  );
}

const styles = StyleSheet.create({
  active: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three - 2,
    borderRadius: Radius.md,
  },
  upsell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 4,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
  },
  upsellText: {
    flex: 1,
  },
  upsellTitle: {
    fontWeight: 900,
  },
});
