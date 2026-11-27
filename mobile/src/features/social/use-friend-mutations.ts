import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';

import { api } from '@/api/endpoints';
import { invalidateSocial } from '@/api/queries';
import type { UserProfile } from '@/api/types';
import { errorMessage } from '@/lib/format';

/** Accept or decline an incoming friend request. */
export function useRespondFriendRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'accept' | 'decline' }) => api.respondFriendRequest(id, action),
    onSuccess: () => invalidateSocial(queryClient),
    onError: (e) => Alert.alert('Something went wrong', errorMessage(e)),
  });
}

/** Send a friend request (accepts theirs if they already asked). */
export function useSendFriendRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.sendFriendRequest(userId),
    onSuccess: () => invalidateSocial(queryClient),
    onError: (e) => Alert.alert('Could not send request', errorMessage(e)),
  });
}

/** Remove a friend, or cancel a request you sent: the server treats both the same. */
export function useRemoveFriend() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.removeFriend(userId),
    onSuccess: () => invalidateSocial(queryClient),
    onError: (e) => Alert.alert('Something went wrong', errorMessage(e)),
  });
}

/** Unblock a player. Pair it with confirmUnblock() from the safety menu. */
export function useUnblockUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.unblockUser(userId),
    onSuccess: () => invalidateSocial(queryClient),
    onError: (e) => Alert.alert('Could not unblock', errorMessage(e)),
  });
}

/** The profile's main button: add, accept, cancel or remove, depending on the relationship. */
export function useFriendAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (p: UserProfile) => {
      switch (p.friendStatus) {
        case 'none':
          return api.sendFriendRequest(p.user.id);
        case 'incoming':
          return api.respondFriendRequest(p.requestId!, 'accept');
        case 'outgoing':
        case 'friends':
          return api.removeFriend(p.user.id);
      }
    },
    onSuccess: () => invalidateSocial(queryClient),
    onError: (e) => Alert.alert('Something went wrong', errorMessage(e)),
  });
}
