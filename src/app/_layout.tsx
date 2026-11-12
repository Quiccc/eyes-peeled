import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { initAds } from '@/ads/ads';
import { AuthProvider, useAuth } from '@/auth/auth-provider';
import { queryClient } from '@/lib/query-client';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <StatusBar style="auto" />
          <RootNavigator />
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function RootNavigator() {
  const { status, user } = useAuth();
  const signedIn = status === 'signedIn';
  const hasUsername = signedIn && !!user.username;

  useEffect(() => {
    if (status !== 'loading') SplashScreen.hideAsync();
  }, [status]);

  useEffect(() => {
    // Ask for ad consent / tracking only once the user is in the app, not on the sign-in screen.
    if (hasUsername) initAds();
  }, [hasUsername]);

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
        <Stack.Screen name="user/[userId]" options={{ title: '' }} />
      </Stack.Protected>
    </Stack>
  );
}
