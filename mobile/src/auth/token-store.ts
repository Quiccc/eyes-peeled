import * as SecureStore from 'expo-secure-store';

import type { AuthProvider, AuthTokens } from '@/api/types';

const KEY = 'auth.tokens';
/** Which provider the current session signed in with; Apple accounts need a re-auth to delete. */
const PROVIDER_KEY = 'auth.provider';

let cached: AuthTokens | null = null;

export async function loadTokens(): Promise<AuthTokens | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    cached = raw ? (JSON.parse(raw) as AuthTokens) : null;
  } catch {
    cached = null;
  }
  return cached;
}

export function getTokens(): AuthTokens | null {
  return cached;
}

export async function saveTokens(tokens: AuthTokens): Promise<void> {
  cached = tokens;
  await SecureStore.setItemAsync(KEY, JSON.stringify(tokens));
}

export async function clearTokens(): Promise<void> {
  cached = null;
  await SecureStore.deleteItemAsync(KEY);
  await SecureStore.deleteItemAsync(PROVIDER_KEY);
}

export async function saveSignInProvider(provider: AuthProvider): Promise<void> {
  await SecureStore.setItemAsync(PROVIDER_KEY, provider);
}

export async function loadSignInProvider(): Promise<AuthProvider | null> {
  try {
    const value = await SecureStore.getItemAsync(PROVIDER_KEY);
    return value === 'apple' || value === 'google' ? value : null;
  } catch {
    return null;
  }
}
