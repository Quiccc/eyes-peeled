import { clearTokens, getTokens, saveTokens } from '@/auth/token-store';

import type { ApiErrorBody, AuthTokens } from './types';

export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');

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
};

let refreshing: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  const tokens = getTokens();
  if (!tokens) return false;
  // Share one in-flight refresh between concurrent 401s.
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      });
      if (!res.ok) return false;
      await saveTokens((await res.json()) as AuthTokens);
      return true;
    } catch {
      return false;
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
  const { method = 'GET', body, form, query, anonymous } = options;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (!form && body !== undefined) headers['Content-Type'] = 'application/json';
  const tokens = getTokens();
  if (!anonymous && tokens) headers.Authorization = `Bearer ${tokens.accessToken}`;

  const res = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });

  if (res.status === 401 && !anonymous) {
    if (!retried && (await refreshTokens())) {
      return request<T>(path, options, true);
    }
    await clearTokens();
    onAuthFailure?.();
    throw new ApiError(401, 'unauthorized', 'Your session has expired. Please sign in again.');
  }

  if (!res.ok) {
    let err: ApiErrorBody = { code: 'http_error', message: `Request failed (${res.status})` };
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
