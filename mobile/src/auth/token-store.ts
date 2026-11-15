import * as SecureStore from 'expo-secure-store';

import type { AuthTokens } from '@/api/types';

const KEY = 'auth.tokens';

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
}
