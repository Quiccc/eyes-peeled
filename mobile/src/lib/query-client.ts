import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

// Refetch active queries when the app returns to the foreground.
focusManager.setEventListener((setFocused) => {
  const sub = AppState.addEventListener('change', (state) => {
    if (Platform.OS !== 'web') setFocused(state === 'active');
  });
  return () => sub.remove();
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

export const queryKeys = {
  daily: ['daily'] as const,
  leaderboard: (scope: string) => ['leaderboard', scope] as const,
  feed: ['feed', 'today'] as const,
  friendRequests: ['friends', 'requests'] as const,
  search: (q: string) => ['users', 'search', q] as const,
  profile: (userId: string) => ['users', userId] as const,
  myProfile: ['me', 'profile'] as const,
};
