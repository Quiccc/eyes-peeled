import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { clearTokens, getTokens, saveTokens } from '@/auth/token-store';
import { currentLocale, t } from '@/i18n';

import type { ApiErrorBody, AuthTokens } from './types';

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type AuthFailureListener = () => void;
let onAuthFailure: AuthFailureListener | null = null;

/** Called when the session can't be refreshed; AuthProvider uses it to sign the user out. */
export function setAuthFailureListener(listener: AuthFailureListener | null) {
  onAuthFailure = listener;
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** JSON body */
  body?: unknown;
  /** Multipart body (takes precedence over `body`) */
  form?: FormData;
  query?: Record<string, string | number | null | undefined>;
  /** Skip the Authorization header (sign-in / refresh) */
  anonymous?: boolean;
  /** Abort after this many ms. Defaults to 15 s for JSON and 60 s for uploads. */
  timeoutMs?: number;
};

/**
 * Sent on every request: the version lets the server reject outdated builds (426 upgrade_required),
 * the language gets words, verdicts and error messages back in the app's language.
 */
function clientHeaders() {
  return {
    'X-App-Version': Constants.expoConfig?.version ?? '0.0.0',
    'X-Platform': Platform.OS,
    'Accept-Language': currentLocale(),
  };
}

const JSON_TIMEOUT_MS = 15_000;
const UPLOAD_TIMEOUT_MS = 60_000;

/**
 * fetch with a timeout, so a dead network can't hang a screen forever. Network failures and
 * timeouts become ApiError(0, 'network' | 'timeout') with a message the app can show.
 */
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    if (controller.signal.aborted) {
      throw new ApiError(0, 'timeout', t('errors.timeout'));
    }
    // The player sees "offline", but the real cause (e.g. a request that couldn't be built) belongs
    // in the Metro log.
    if (__DEV__) console.warn(`[api] ${init.method ?? 'GET'} ${url} failed:`, e);
    throw new ApiError(0, 'network', t('errors.offline'));
  } finally {
    clearTimeout(timer);
  }
}

let refreshing: Promise<boolean> | null = null;

/**
 * Resolves true when new tokens were saved, false when the server rejected the refresh token (4xx).
 * Throws on network errors, timeouts and 5xx, so a flaky connection never signs the user out.
 */
async function refreshTokens(): Promise<boolean> {
  const tokens = getTokens();
  if (!tokens) return false;
  // Share one in-flight refresh between concurrent 401s.
  refreshing ??= (async () => {
    try {
      const res = await fetchWithTimeout(
        `${API_BASE_URL}/auth/refresh`,
        {
          method: 'POST',
          headers: { ...clientHeaders(), 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ refreshToken: tokens.refreshToken }),
        },
        JSON_TIMEOUT_MS,
      );
      if (res.status >= 400 && res.status < 500) return false;
      if (!res.ok) throw new ApiError(res.status, 'http_error', t('errors.server'));
      await saveTokens((await res.json()) as AuthTokens);
      return true;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

function buildUrl(path: string, query?: RequestOptions['query']) {
  const params = Object.entries(query ?? {})
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return `${API_BASE_URL}${path}${params ? `?${params}` : ''}`;
}

export async function request<T>(path: string, options: RequestOptions = {}, retried = false): Promise<T> {
  const { method = 'GET', body, form, query, anonymous, timeoutMs } = options;
  const headers: Record<string, string> = { ...clientHeaders(), Accept: 'application/json' };
  if (!form && body !== undefined) headers['Content-Type'] = 'application/json';
  const tokens = getTokens();
  if (!anonymous && tokens) headers.Authorization = `Bearer ${tokens.accessToken}`;

  const res = await fetchWithTimeout(
    buildUrl(path, query),
    {
      method,
      headers,
      body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
    },
    timeoutMs ?? (form ? UPLOAD_TIMEOUT_MS : JSON_TIMEOUT_MS),
  );

  if (res.status === 401 && !anonymous) {
    if (!retried && (await refreshTokens())) {
      return request<T>(path, options, true);
    }
    await clearTokens();
    onAuthFailure?.();
    throw new ApiError(401, 'unauthorized', t('errors.sessionExpired'));
  }

  if (!res.ok) {
    let err: ApiErrorBody = { code: 'http_error', message: t('errors.requestFailed', { status: res.status }) };
    try {
      err = (await res.json()) as ApiErrorBody;
    } catch {
      // non-JSON error body
    }
    throw new ApiError(res.status, err.code, err.message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
