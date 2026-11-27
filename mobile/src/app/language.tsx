import { getLocales } from 'expo-localization';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Edge, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { setLanguage, useLanguagePref, type LanguagePref } from '@/i18n/language';
import { LANGUAGES, pickLocale } from '@/i18n/languages';
import { tap } from '@/lib/haptics';

/** Profile → Language: follow the phone, or pick one of the app's languages (each named in itself). */
export default function LanguageScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const pref = useLanguagePref();
  const phone = pickLocale(getLocales().map((l) => l.languageTag));
  const phoneName = LANGUAGES.find((l) => l.locale === phone)?.name ?? phone;

  const rows: { value: LanguagePref; title: string; subtitle?: string }[] = [
    { value: 'system', title: t('language.system'), subtitle: t('language.systemHint', { language: phoneName }) },
    ...LANGUAGES.map((l) => ({ value: l.locale, title: l.name })),
  ];

  return (
    <ThemedView style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        <View
          accessibilityRole="radiogroup"
          style={[styles.group, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          {rows.map((row, i) => {
            const selected = row.value === pref;
            return (
              <Pressable
                key={row.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                onPress={() => {
                  tap();
                  void setLanguage(row.value);
                }}
                style={({ pressed }) => [
                  styles.row,
                  i > 0 && { borderTopWidth: 2, borderTopColor: theme.border },
                  pressed && { backgroundColor: theme.backgroundSelected },
                ]}>
                <View style={styles.text}>
                  <ThemedText>{row.title}</ThemedText>
                  {row.subtitle ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {row.subtitle}
                    </ThemedText>
                  ) : null}
                </View>
                {selected ? <Icon name="check" size={20} color={theme.text} /> : null}
              </Pressable>
            );
          })}
        </View>
        <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
          {t('language.note')}
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 480,
  },
  group: {
    borderRadius: Radius.lg,
    borderWidth: 2,
    borderBottomWidth: Edge.button,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    minHeight: 56,
    paddingVertical: Spacing.two,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  note: {
    textAlign: 'center',
  },
});
