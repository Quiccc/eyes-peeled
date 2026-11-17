import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

import type { LeaderboardScope } from '@/api/types';

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

/**
 * Every query key in the app. Keys are hierarchical, so a prefix invalidates a whole area:
 * `usersAll` covers profiles and search, `friendsAll` the requests and blocked players,
 * `leaderboardAll` both scopes.
 */
export const queryKeys = {
  daily: ['daily'] as const,
  leaderboardAll: ['leaderboard'] as const,
  leaderboard: (scope: LeaderboardScope) => ['leaderboard', scope] as const,
  feed: ['feed', 'today'] as const,
  friendsAll: ['friends'] as const,
  friendRequests: ['friends', 'requests'] as const,
  blockedUsers: ['friends', 'blocked'] as const,
  usersAll: ['users'] as const,
  search: (q: string) => ['users', 'search', q] as const,
  profile: (userId: string) => ['users', 'profile', userId] as const,
  myProfile: ['me', 'profile'] as const,
  premiumOffer: ['premium', 'offer'] as const,
};
