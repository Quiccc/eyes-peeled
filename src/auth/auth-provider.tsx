import { useQueryClient } from '@tanstack/react-query';
import { createContext, use, useEffect, useState, type PropsWithChildren } from 'react';

import { setAuthFailureListener } from '@/api/client';
import { api, USE_MOCK_API } from '@/api/endpoints';
import type { AuthProvider as Provider, User } from '@/api/types';

import { getAppleCredential, getGoogleCredential, signOutOfProviders } from './social-sign-in';
import { clearTokens, loadTokens, saveTokens } from './token-store';

type AuthState =
  | { status: 'loading'; user: null }
  | { status: 'signedOut'; user: null }
  | { status: 'signedIn'; user: User };

type AuthContextValue = AuthState & {
  signIn(provider: Provider): Promise<void>;
  signOut(): Promise<void>;
  deleteAccount(): Promise<void>;
  setUsername(username: string): Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null });

  const resetLocal = async () => {
    await clearTokens();
    queryClient.clear();
    setState({ status: 'signedOut', user: null });
  };

  useEffect(() => {
    setAuthFailureListener(() => {
      queryClient.clear();
      setState({ status: 'signedOut', user: null });
    });
    (async () => {
      const tokens = await loadTokens();
      if (!tokens) {
        setState({ status: 'signedOut', user: null });
        return;
      }
      try {
        const user = await api.getMe();
        setState({ status: 'signedIn', user });
      } catch {
        // Expired session (401 already cleared tokens) or offline — require sign-in.
        setState({ status: 'signedOut', user: null });
      }
    })();
    return () => setAuthFailureListener(null);
  }, [queryClient]);

  const value: AuthContextValue = {
    ...state,
    async signIn(provider) {
      // In mock mode skip the native SDKs so the app runs without OAuth credentials.
      const credential = USE_MOCK_API
        ? { provider, idToken: 'mock' }
        : provider === 'apple'
          ? await getAppleCredential()
          : await getGoogleCredential();
      const res = await api.signIn(credential);
      await saveTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
      setState({ status: 'signedIn', user: res.user });
    },
    async signOut() {
      try {
        await api.signOut();
      } catch {
        // best effort — local sign-out still happens
      }
      await signOutOfProviders();
      await resetLocal();
    },
    async deleteAccount() {
      await api.deleteMe();
      await signOutOfProviders();
      await resetLocal();
    },
    async setUsername(username) {
      const user = await api.updateMe({ username });
      setState({ status: 'signedIn', user });
    },
  };

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
