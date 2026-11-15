import { useCallback, useEffect, useState } from 'react';

import { ApiError } from './api';

/** Load data on mount and when `deps` change; `reload` refetches. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const run = useCallback(load, deps);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setData(await run());
      setError(null);
    } catch (e) {
      setError(message(e));
    } finally {
      setLoading(false);
    }
  }, [run]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, loading, reload };
}

export function message(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  return e instanceof Error ? e.message : 'Something went wrong.';
}

export const pct = (v: number | null | undefined) => (v == null ? '–' : `${Math.round(v * 100)}%`);

export const utcToday = () => new Date().toISOString().slice(0, 10);

export const addDays = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

export const addMonths = (month: string, n: number) => {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
};

export const formatDay = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
