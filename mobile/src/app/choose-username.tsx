import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/auth-provider';
import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage, USERNAME_RE } from '@/lib/format';

export default function ChooseUsernameScreen() {
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
      setError(errorMessage(e));
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
              Pick a username
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              Friends will find you by this name and it shows on the leaderboards.
            </ThemedText>
            <View style={styles.fieldGroup}>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label} nativeID="username-label">
                USERNAME
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
                placeholder="username"
                returnKeyType="done"
                onSubmitEditing={() => valid && submit()}
                accessibilityLabel="Username"
                accessibilityLabelledBy="username-label"
              />
              <ThemedText type="small" style={{ color: error ? theme.dangerText : theme.textSecondary }}>
                {error ?? '3–20 characters: letters, numbers and underscores.'}
              </ThemedText>
            </View>
          </View>
          <View style={styles.actions}>
            <Button title="Continue" disabled={!valid} loading={saving} onPress={submit} />
            <Button title="Sign out" variant="ghost" onPress={signOut} />
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
