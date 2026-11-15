import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { USE_MOCK_API } from '@/api/endpoints';
import type { AuthProvider, Difficulty } from '@/api/types';
import { useAuth } from '@/auth/auth-provider';
import { isAppleSignInAvailable, SignInCancelled } from '@/auth/social-sign-in';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Edge, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/format';

const SAMPLE_WORDS: readonly { word: string; hue: Difficulty; tilt: string }[] = [
  { word: 'BOTTLE', hue: 'easy', tilt: '-3deg' },
  { word: 'BICYCLE', hue: 'medium', tilt: '2deg' },
  { word: 'STOP SIGN', hue: 'hard', tilt: '-2deg' },
];

export default function SignInScreen() {
  const { signIn } = useAuth();
  const theme = useTheme();
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
          <View style={[styles.logo, { backgroundColor: theme.tint, borderBottomColor: theme.tintEdge }]}>
            <Icon name="search" size={60} color={theme.onTint} />
          </View>
          <View style={styles.copy}>
            <ThemedText type="title" style={styles.center} accessibilityRole="header">
              Word Hunt
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.center}>
              Three words a day. Find them in the real world, snap a photo, climb the leaderboard.
            </ThemedText>
          </View>
          <View style={styles.samples} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            {SAMPLE_WORDS.map((s) => (
              <View
                key={s.word}
                style={[
                  styles.sample,
                  { backgroundColor: theme.backgroundElement, borderColor: theme[s.hue], transform: [{ rotate: s.tilt }] },
                ]}>
                <ThemedText type="subtitle" style={styles.sampleText}>
                  {s.word}
                </ThemedText>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.actions}>
          {Platform.OS === 'ios' && appleAvailable && !USE_MOCK_API ? (
            // The system button keeps App Review happy; shaped to match the chunky buttons below.
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={
                scheme === 'dark'
                  ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                  : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
              }
              cornerRadius={18}
              style={styles.appleButton}
              onPress={() => handle('apple')}
            />
          ) : Platform.OS === 'ios' || USE_MOCK_API ? (
            <Button
              title="Continue with Apple"
              variant="ink"
              height={56}
              loading={pending === 'apple'}
              disabled={!!pending}
              onPress={() => handle('apple')}
            />
          ) : null}
          <Button
            title="Continue with Google"
            variant="secondary"
            height={56}
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
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    gap: Spacing.five,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
  },
  logo: {
    width: 112,
    height: 112,
    borderRadius: 36,
    borderBottomWidth: 8,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-6deg' }],
  },
  copy: {
    gap: Spacing.two,
  },
  samples: {
    alignItems: 'center',
    gap: Spacing.two + 2,
  },
  sample: {
    paddingHorizontal: 18,
    paddingVertical: Spacing.two,
    borderRadius: 16,
    borderWidth: 2,
    borderBottomWidth: Edge.button,
  },
  sampleText: {
    letterSpacing: 1,
  },
  center: {
    textAlign: 'center',
  },
  actions: {
    gap: 14,
  },
  appleButton: {
    height: 56,
    width: '100%',
  },
});
