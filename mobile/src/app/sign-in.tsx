import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Platform, StyleSheet, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { USE_MOCK_API } from '@/api/endpoints';
import type { AuthProvider, Difficulty } from '@/api/types';
import { DEV_LOGIN, useAuth } from '@/auth/auth-provider';
import { GOOGLE_SIGN_IN_AVAILABLE, isAppleSignInAvailable, SignInCancelled } from '@/auth/social-sign-in';
import { Button } from '@/components/button';
import { EyesPeeledLogo } from '@/components/eyes-peeled-logo';
import { SampleWordChip } from '@/components/sample-word-chip';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PRIVACY_URL, TERMS_URL } from '@/constants/links';
import { Spacing } from '@/constants/theme';
import { useAsyncAction } from '@/hooks/use-async-action';

const SAMPLE_WORDS = [
  { key: 'search', hue: 'easy', tilt: -3 },
  { key: 'find', hue: 'medium', tilt: 2 },
  { key: 'snap', hue: 'hard', tilt: -2 },
  // The premium word stays a mystery until you buy Premium.
  { key: null, hue: 'expert', tilt: 3 },
] as const satisfies readonly { key: string | null; hue: Difficulty; tilt: number }[];

export default function SignInScreen() {
  const { t, i18n } = useTranslation();
  const { signIn } = useAuth();
  const scheme = useColorScheme();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const { busy: pending, run } = useAsyncAction<AuthProvider>();

  useEffect(() => {
    isAppleSignInAvailable().then(setAppleAvailable);
  }, []);

  const handle = (provider: AuthProvider) =>
    run(provider, () => signIn(provider), {
      errorTitle: t('signIn.failed'),
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
              {t('signIn.tagline')}
            </ThemedText>
          </View>
          <View style={styles.samples} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            {SAMPLE_WORDS.map((s, i) => {
              const word = s.key ? t(`signIn.sample.${s.key}`).toLocaleUpperCase(i18n.language) : '? ? ? ?';
              return <SampleWordChip key={s.hue} word={word} hue={s.hue} tilt={s.tilt} index={i} />;
            })}
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
              title={t('signIn.apple')}
              variant="ink"
              height={56}
              loading={pending === 'apple'}
              disabled={!!pending}
              onPress={() => handle('apple')}
            />
          ) : null}
          {/* Dev login skips the Google SDK, so the button works without a client ID. */}
          {(GOOGLE_SIGN_IN_AVAILABLE || USE_MOCK_API || !!DEV_LOGIN) && (
            <Button
              title={t('signIn.google')}
              variant="secondary"
              height={56}
              loading={pending === 'google'}
              disabled={!!pending}
              onPress={() => handle('google')}
            />
          )}
          <ThemedText type="small" themeColor="textSecondary" style={[styles.center, styles.legal]}>
            <Trans
              i18nKey="signIn.legal"
              components={{
                terms: (
                  <ThemedText
                    type="small"
                    style={styles.link}
                    accessibilityRole="link"
                    onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)}
                  />
                ),
                privacy: (
                  <ThemedText
                    type="small"
                    style={styles.link}
                    accessibilityRole="link"
                    onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)}
                  />
                ),
              }}
            />
          </ThemedText>
          {USE_MOCK_API && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              Mock API mode: sign-in is simulated.
            </ThemedText>
          )}
          {!USE_MOCK_API && !!DEV_LOGIN && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              Dev login: signs in as {DEV_LOGIN}.
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
