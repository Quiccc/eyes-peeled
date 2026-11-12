import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { USE_MOCK_API } from '@/api/endpoints';
import type { AuthProvider } from '@/api/types';
import { useAuth } from '@/auth/auth-provider';
import { isAppleSignInAvailable, SignInCancelled } from '@/auth/social-sign-in';
import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { errorMessage } from '@/lib/format';

export default function SignInScreen() {
  const { signIn } = useAuth();
  const scheme = useColorScheme();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [pending, setPending] = useState<AuthProvider | null>(null);

  useEffect(() => {
    isAppleSignInAvailable().then(setAppleAvailable);
  }, []);

  const handle = async (provider: AuthProvider) => {
    setPending(provider);
    try {
      await signIn(provider);
    } catch (e) {
      if (!(e instanceof SignInCancelled)) Alert.alert('Sign-in failed', errorMessage(e));
    } finally {
      setPending(null);
    }
  };

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.container}>
        <View style={styles.hero}>
          <ThemedText style={styles.emoji}>📸</ThemedText>
          <ThemedText type="title" style={styles.center}>
            Word Hunt
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.center}>
            Three new words every day.{'\n'}Find them in real life. Snap them first.
          </ThemedText>
        </View>

        <View style={styles.actions}>
          {Platform.OS === 'ios' && appleAvailable && !USE_MOCK_API ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={
                scheme === 'dark'
                  ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                  : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
              }
              cornerRadius={14}
              style={styles.appleButton}
              onPress={() => handle('apple')}
            />
          ) : Platform.OS === 'ios' || USE_MOCK_API ? (
            <Button
              title="Continue with Apple"
              variant="secondary"
              loading={pending === 'apple'}
              disabled={!!pending}
              onPress={() => handle('apple')}
            />
          ) : null}
          <Button
            title="Continue with Google"
            variant="secondary"
            loading={pending === 'google'}
            disabled={!!pending}
            onPress={() => handle('google')}
          />
          {USE_MOCK_API && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              Mock API mode: sign-in is simulated.
            </ThemedText>
          )}
        </View>
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
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  emoji: {
    fontSize: 72,
    lineHeight: 84,
  },
  center: {
    textAlign: 'center',
  },
  actions: {
    gap: Spacing.three,
    paddingBottom: Spacing.three,
  },
  appleButton: {
    height: 52,
    width: '100%',
  },
});
