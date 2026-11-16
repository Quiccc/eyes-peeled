import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { USE_MOCK_API } from '@/api/endpoints';
import type { AuthProvider, Difficulty } from '@/api/types';
import { useAuth } from '@/auth/auth-provider';
import { isAppleSignInAvailable, SignInCancelled } from '@/auth/social-sign-in';
import { Button } from '@/components/button';
import { EyesPeeledLogo } from '@/components/eyes-peeled-logo';
import { SampleWordChip } from '@/components/sample-word-chip';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PRIVACY_URL, TERMS_URL } from '@/constants/links';
import { Spacing } from '@/constants/theme';
import { useAsyncAction } from '@/hooks/use-async-action';

const SAMPLE_WORDS: readonly { word: string; hue: Difficulty; tilt: number }[] = [
  { word: 'SEARCH', hue: 'easy', tilt: -3 },
  { word: 'FIND', hue: 'medium', tilt: 2 },
  { word: 'SNAP', hue: 'hard', tilt: -2 },
  // The premium word stays a mystery until you buy Premium.
  { word: '? ? ? ?', hue: 'expert', tilt: 3 },
];

export default function SignInScreen() {
  const { signIn } = useAuth();
  const scheme = useColorScheme();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const { busy: pending, run } = useAsyncAction<AuthProvider>();

  useEffect(() => {
    isAppleSignInAvailable().then(setAppleAvailable);
  }, []);

  const handle = (provider: AuthProvider) =>
    run(provider, () => signIn(provider), {
      errorTitle: 'Sign-in failed',
      ignore: (e) => e instanceof SignInCancelled,
    });

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.container}>
        <View style={styles.hero}>
          <EyesPeeledLogo />
          <View style={styles.copy}>
            <ThemedText type="title" style={styles.center} accessibilityRole="header">
              Eyes Peeled
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.center}>
              Three words a day. Find them in the real world, snap a photo, climb the leaderboard.
            </ThemedText>
          </View>
          <View style={styles.samples} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            {SAMPLE_WORDS.map((s, i) => (
              <SampleWordChip key={s.word} word={s.word} hue={s.hue} tilt={s.tilt} index={i} />
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
          <ThemedText type="small" themeColor="textSecondary" style={[styles.center, styles.legal]}>
            By continuing you agree to the{' '}
            <ThemedText type="small" style={styles.link} accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)}>
              Terms
            </ThemedText>{' '}
            and{' '}
            <ThemedText type="small" style={styles.link} accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)}>
              Privacy Policy
            </ThemedText>
            .
          </ThemedText>
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
    paddingTop: 48,
    paddingBottom: Spacing.four,
    gap: Spacing.five,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
  },
  copy: {
    gap: Spacing.two,
  },
  samples: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  center: {
    textAlign: 'center',
  },
  legal: {
    marginTop: Spacing.two,
  },
  link: {
    textDecorationLine: 'underline',
  },
  actions: {
    gap: 14,
  },
  appleButton: {
    height: 56,
    width: '100%',
  },
});
