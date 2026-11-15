import { type QueryClient, useQuery } from '@tanstack/react-query';

import { api } from '@/api/endpoints';
import type { Submission } from '@/api/types';
import { queryKeys } from '@/lib/query-client';
import { getPremiumOffer } from '@/purchases/purchases';

/** Shortest search the server answers; shorter input shows the regular friends view. */
export const MIN_SEARCH_LENGTH = 2;

// ---- queries ---------------------------------------------------------------

export function useDaily() {
  return useQuery({ queryKey: queryKeys.daily, queryFn: api.getDaily });
}

export function useMyProfile() {
  return useQuery({ queryKey: queryKeys.myProfile, queryFn: api.getMyProfile });
}

export function useFriendRequests() {
  return useQuery({ queryKey: queryKeys.friendRequests, queryFn: api.getFriendRequests });
}

export function useFeedToday() {
  return useQuery({ queryKey: queryKeys.feed, queryFn: api.getFeedToday });
}

export function useUserSearch(q: string) {
  return useQuery({
    queryKey: queryKeys.search(q),
    queryFn: () => api.searchUsers(q),
    enabled: q.length >= MIN_SEARCH_LENGTH,
  });
}

export function useUserProfile(userId: string) {
  return useQuery({ queryKey: queryKeys.profile(userId), queryFn: () => api.getUserProfile(userId) });
}

export function usePremiumOffer() {
  return useQuery({ queryKey: queryKeys.premiumOffer, queryFn: getPremiumOffer, staleTime: Infinity });
}

// ---- what to refresh after a change ----------------------------------------

/** A friendship, request or block changed: refresh everything that shows other users. */
export function invalidateSocial(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.friendsAll });
  queryClient.invalidateQueries({ queryKey: queryKeys.usersAll });
  queryClient.invalidateQueries({ queryKey: queryKeys.feed });
  queryClient.invalidateQueries({ queryKey: queryKeys.leaderboard('friends') });
}

/** A photo got its verdict: the word's status always changes, scores only for a valid find. */
export function invalidateAfterVerdict(queryClient: QueryClient, submission: Submission) {
  queryClient.invalidateQueries({ queryKey: queryKeys.daily });
  if (submission.status === 'valid') {
    queryClient.invalidateQueries({ queryKey: queryKeys.leaderboardAll });
    queryClient.invalidateQueries({ queryKey: queryKeys.myProfile });
  }
}
