import type { ReactNode } from 'react';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { errorMessage } from '@/lib/format';

type QueryLike<T> = {
  data: T | undefined;
  isPending: boolean;
  error: Error | null;
  refetch: () => unknown;
};

type Props<T> = {
  query: QueryLike<T>;
  /** Shown while the first load is in flight, e.g. <SkeletonRows />. */
  loading: ReactNode;
  /** Headline of the error state, e.g. "Couldn't load the leaderboard". */
  errorTitle: string;
  /** Illustration for the error state (components/illustrations); the retry icon otherwise. */
  errorArt?: ReactNode;
  children: (data: T) => ReactNode;
};

/**
 * The three states of a screen's main query, the same way everywhere: placeholder while loading,
 * an error with a retry button, then the content. Data that loaded once stays up if a refetch fails.
 */
export function QueryState<T>({ query, loading, errorTitle, errorArt, children }: Props<T>) {
  if (query.data !== undefined) return children(query.data);
  if (query.isPending) return loading;
  return (
    <EmptyState
      icon="retry"
      art={errorArt}
      title={errorTitle}
      hint={errorMessage(query.error)}
      action={<Button title="Try again" variant="secondary" onPress={() => query.refetch()} />}
    />
  );
}
