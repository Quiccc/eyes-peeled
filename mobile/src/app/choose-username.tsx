import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/auth-provider';
import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useFormat, USERNAME_RE } from '@/lib/format';

export default function ChooseUsernameScreen() {
  const fmt = useFormat();
  const { t } = useTranslation();
  const { setUsername, signOut } = useAuth();
  const theme = useTheme();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const clean = value.trim().toLowerCase();
  const valid = USERNAME_RE.test(clean);

  // The server's reason (e.g. "taken") shows under the field instead of in an alert.
  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await setUsername(clean);
    } catch (e) {
      setError(fmt.errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex}>
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.top}>
            <ThemedText type="title" accessibilityRole="header">
              {t('username.title')}
            </ThemedText>
            <ThemedText themeColor="textSecondary">{t('username.intro')}</ThemedText>
            <View style={styles.fieldGroup}>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label} nativeID="username-label">
                {t('username.label')}
              </ThemedText>
              <TextField
                size="large"
                prefix="@"
                accent
                invalid={!!error}
                value={value}
                onChangeText={setValue}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                maxLength={20}
                placeholder={t('username.placeholder')}
                returnKeyType="done"
                onSubmitEditing={() => valid && submit()}
                accessibilityLabel={t('username.a11y')}
                accessibilityLabelledBy="username-label"
              />
              <ThemedText type="small" style={{ color: error ? theme.dangerText : theme.textSecondary }}>
                {error ?? t('username.rule')}
              </ThemedText>
            </View>
          </View>
          <View style={styles.actions}>
            <Button title={t('common.continue')} disabled={!valid} loading={saving} onPress={submit} />
            <Button title={t('profile.signOut')} variant="ghost" onPress={signOut} />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    justifyContent: 'space-between',
    padding: Spacing.four,
  },
  top: {
    gap: Spacing.three,
    paddingTop: 48,
  },
  fieldGroup: {
    gap: Spacing.two,
  },
  label: {
    letterSpacing: 1,
  },
  actions: {
    gap: 10,
  },
});
