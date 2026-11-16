import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

import { initAds, setAdsEnabled } from '@/ads/ads';
import { AuthProvider, useAuth } from '@/auth/auth-provider';
import { AnimatedSplash } from '@/components/animated-splash';
import { ThemeTransitionOverlay } from '@/components/theme-transition';
import { loadAppearance } from '@/lib/appearance';
import { queryClient } from '@/lib/query-client';

SplashScreen.preventAutoHideAsync();
// Apply the saved Light/Dark/System choice before the launch screen fades (no wrong-theme flash).
const appearanceReady = loadAppearance();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <StatusBar style="auto" />
          <RootNavigator />
          <ThemeTransitionOverlay />
          <LaunchSplash />
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

/**
 * The animated launch screen. It takes over from the native splash as soon as it renders, and fades out
 * once the saved appearance is applied and we know whether someone is signed in.
 */
function LaunchSplash() {
  const { status } = useAuth();
  const [appearanceLoaded, setAppearanceLoaded] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    void appearanceReady.finally(() => setAppearanceLoaded(true));
  }, []);

  if (done) return null;
  return <AnimatedSplash ready={status !== 'loading' && appearanceLoaded} onDone={() => setDone(true)} />;
}

function RootNavigator() {
  const { status, user } = useAuth();
  const signedIn = status === 'signedIn';
  const hasUsername = signedIn && !!user.username;
  const isPremium = signedIn && user.isPremium;

  useEffect(() => {
    setAdsEnabled(!isPremium);
    // Ask for ad consent / tracking only once the user is in the app, not on the sign-in screen.
    // Premium users never see ads, so they never get the consent / tracking prompts either.
    if (hasUsername && !isPremium) initAds();
  }, [hasUsername, isPremium]);

  if (status === 'loading') return null;

  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={signedIn && !hasUsername}>
        <Stack.Screen name="choose-username" options={{ headerShown: false, gestureEnabled: false }} />
      </Stack.Protected>

      <Stack.Protected guard={hasUsername}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="hunt/[wordId]"
          options={{ presentation: 'fullScreenModal', headerShown: false, gestureEnabled: false }}
        />
        <Stack.Screen name="user/[userId]" options={{ headerShown: false }} />
        <Stack.Screen name="premium" options={{ presentation: 'modal', headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}
