import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/auth-provider';
import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/format';

const VALID = /^[a-z0-9_]{3,20}$/;

export default function ChooseUsernameScreen() {
  const { setUsername, signOut } = useAuth();
  const theme = useTheme();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const clean = value.trim().toLowerCase();
  const valid = VALID.test(clean);

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
            <ThemedText type="subtitle">Pick a username</ThemedText>
            <ThemedText themeColor="textSecondary">
              Friends will find you by this name and it shows on the leaderboards.
            </ThemedText>
            <TextInput
              value={value}
              onChangeText={setValue}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              maxLength={20}
              placeholder="username"
              placeholderTextColor={theme.textSecondary}
              returnKeyType="done"
              onSubmitEditing={() => valid && submit()}
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            />
            <ThemedText type="small" style={{ color: error ? theme.danger : theme.textSecondary }}>
              {error ?? '3–20 characters: letters, numbers and underscores.'}
            </ThemedText>
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
    paddingTop: Spacing.five,
  },
  input: {
    fontSize: 20,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: 14,
  },
  actions: {
    gap: Spacing.two,
  },
});
