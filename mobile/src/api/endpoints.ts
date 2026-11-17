import { File } from 'expo-file-system';

import { request } from './client';
import { mockApi } from './mock';
import type {
  AuthRequest,
  AuthResponse,
  BlockedUser,
  Daily,
  FeedItem,
  FriendRequest,
  Leaderboard,
  LeaderboardScope,
  ReportReason,
  Submission,
  User,
  UserProfile,
  UserSearchResult,
} from './types';

export type PhotoFile = { uri: string; name: string; type: string };

/** Every backend call the app makes. Implemented by the HTTP client and by the in-memory mock. */
export type Api = {
  // auth & account
  signIn(req: AuthRequest): Promise<AuthResponse>;
  signOut(): Promise<void>;
  getMe(): Promise<User>;
  updateMe(patch: { username: string }): Promise<User>;
  deleteMe(): Promise<void>;
  getMyProfile(): Promise<UserProfile>;

  // purchases
  /** Ask the server to re-check the user's RevenueCat entitlement (after a purchase/restore). Returns the updated user. */
  syncPurchases(): Promise<User>;

  // game
  getDaily(): Promise<Daily>;
  submitPhoto(wordId: string, photo: PhotoFile): Promise<Submission>;
  getSubmission(id: string): Promise<Submission>;

  // leaderboard
  getLeaderboard(params: { scope: LeaderboardScope; cursor?: string | null }): Promise<Leaderboard>;

  // social
  getFeedToday(): Promise<FeedItem[]>;
  getFriendRequests(): Promise<FriendRequest[]>;
  sendFriendRequest(userId: string): Promise<void>;
  respondFriendRequest(requestId: string, action: 'accept' | 'decline'): Promise<void>;
  removeFriend(userId: string): Promise<void>;
  searchUsers(q: string): Promise<UserSearchResult[]>;
  getUserProfile(userId: string): Promise<UserProfile>;

  // safety
  report(params: { submissionId?: string; userId?: string; reason: ReportReason }): Promise<void>;
  blockUser(userId: string): Promise<void>;
  unblockUser(userId: string): Promise<void>;
  getBlockedUsers(): Promise<BlockedUser[]>;
};

const httpApi: Api = {
  signIn: (req) => request('/auth/signin', { method: 'POST', body: req, anonymous: true }),
  signOut: () => request('/auth/signout', { method: 'POST' }),
  getMe: () => request('/me'),
  updateMe: (patch) => request('/me', { method: 'PATCH', body: patch }),
  deleteMe: () => request('/me', { method: 'DELETE' }),
  getMyProfile: () => request('/me/profile'),

  syncPurchases: () => request('/me/purchases/sync', { method: 'POST' }),

  getDaily: () => request('/daily'),
  submitPhoto: (wordId, photo) => {
    const form = new FormData();
    // Expo's fetch (the global fetch since SDK 58) only sends FormData parts that are strings or
    // Blob-like files with bytes(). React Native's old { uri, name, type } descriptor makes it throw
    // before anything is sent, which surfaced as "You seem to be offline". An expo-file-system File
    // reads the JPEG from disk when the request is built.
    form.append('photo', new File(photo.uri) as unknown as Blob, photo.name);
    return request(`/words/${encodeURIComponent(wordId)}/submissions`, { method: 'POST', form });
  },
  getSubmission: (id) => request(`/submissions/${encodeURIComponent(id)}`),

  getLeaderboard: ({ scope, cursor }) => request('/leaderboard', { query: { scope, cursor } }),

  getFeedToday: () => request('/feed/today'),
  getFriendRequests: () => request('/friends/requests'),
  sendFriendRequest: (userId) => request('/friends/requests', { method: 'POST', body: { userId } }),
  respondFriendRequest: (requestId, action) =>
    request(`/friends/requests/${encodeURIComponent(requestId)}/${action}`, { method: 'POST' }),
  removeFriend: (userId) => request(`/friends/${encodeURIComponent(userId)}`, { method: 'DELETE' }),
  searchUsers: (q) => request('/users/search', { query: { q } }),
  getUserProfile: (userId) => request(`/users/${encodeURIComponent(userId)}`),

  report: (params) => request('/reports', { method: 'POST', body: params }),
  blockUser: (userId) => request('/blocks', { method: 'POST', body: { userId } }),
  unblockUser: (userId) => request(`/blocks/${encodeURIComponent(userId)}`, { method: 'DELETE' }),
  getBlockedUsers: () => request('/blocks'),
};

const MOCK_REQUESTED = process.env.EXPO_PUBLIC_USE_MOCK_API === 'true';
const HAS_API_URL = !!process.env.EXPO_PUBLIC_API_URL;

// Falling back to the mock when the URL is missing is a dev convenience. In a release build it would
// quietly ship a fake backend, so fail at launch instead (the mock can still be chosen on purpose).
if (!__DEV__ && !HAS_API_URL && !MOCK_REQUESTED) {
  throw new Error(
    'EXPO_PUBLIC_API_URL is not set for this release build. Set it in the EAS build profile, ' +
      'or set EXPO_PUBLIC_USE_MOCK_API=true to ship the mock backend on purpose.',
  );
}

export const USE_MOCK_API = MOCK_REQUESTED || !HAS_API_URL;

export const api: Api = USE_MOCK_API ? mockApi : httpApi;
