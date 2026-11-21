/**
 * In-memory fake backend so the app can be built and demoed before the real
 * backend is running. Enabled when EXPO_PUBLIC_USE_MOCK_API=true or, in dev builds only, when
 * no EXPO_PUBLIC_API_URL is set. State resets when the JS bundle reloads.
 */
import { ApiError } from '@/api/client';
import type { Api } from '@/api/endpoints';
import {
  feedFor,
  firstFoundAtFor,
  foundCountFor,
  friendStatus,
  leaderboardEntries,
  myPendingSubmission,
  myValidSubmission,
  profileFor,
  todaysWords,
} from '@/api/mock/builders';
import { INFERENCE_MS, latency, MAX_POINTS, mockUser, others, PAGE_SIZE, uploadTime } from '@/api/mock/fixtures';
import { requireMe, resetMe, rollDay, settlePending, state } from '@/api/mock/state';
import type { Submission } from '@/api/types';
import { USERNAME_RE } from '@/lib/format';

export const mockApi: Api = {
  async signIn() {
    await latency();
    const isNewUser = !state.me;
    state.me ??= mockUser('me', null);
    return { accessToken: 'mock-access', refreshToken: 'mock-refresh', user: state.me, isNewUser };
  },
  async signOut() {
    await latency();
  },
  async getMe() {
    await latency();
    // A restored session after reload: recreate the user so the app can continue.
    state.me ??= mockUser('me', 'you');
    return state.me;
  },
  async updateMe({ username }) {
    await latency();
    const self = requireMe();
    const clean = username.trim().toLowerCase();
    if (!USERNAME_RE.test(clean)) {
      throw new ApiError(400, 'invalid_username', 'Use 3–20 letters, numbers or underscores.');
    }
    if (others.some((o) => o.username === clean)) {
      throw new ApiError(409, 'username_taken', 'That username is taken. Try another one.');
    }
    state.me = { ...self, username: clean };
    return state.me;
  },
  async setAvatar(photo) {
    await latency();
    state.me = { ...requireMe(), avatarUrl: photo.uri };
    return state.me;
  },
  async removeAvatar() {
    await latency();
    state.me = { ...requireMe(), avatarUrl: null };
    return state.me;
  },
  async deleteMe() {
    await latency();
    resetMe();
  },
  async getMyProfile() {
    await latency();
    settlePending();
    return profileFor(requireMe(), true);
  },

  async syncPurchases() {
    await latency();
    // Mock: treat every sync as a successful Premium purchase / restore.
    state.me = { ...requireMe(), isPremium: true };
    return state.me;
  },

  async getDaily() {
    await latency();
    const self = requireMe();
    rollDay();
    settlePending();
    return {
      date: new Date(state.dayStart).toISOString().slice(0, 10),
      nextResetAt: new Date(state.resetAt).toISOString(),
      words: todaysWords(self.isPremium).map((w) => {
        const found = myValidSubmission(w.id);
        const pending = found ? null : myPendingSubmission(w.id);
        const foundCount = foundCountFor(w.difficulty);
        return {
          ...w,
          maxPoints: MAX_POINTS[w.difficulty],
          foundCount,
          firstFoundAt: firstFoundAtFor(w.difficulty, foundCount, found?.createdAt ?? null),
          status: found ? 'found' : pending ? 'pending' : 'open',
          submission: found ?? pending,
        };
      }),
    };
  },

  async submitPhoto(wordId, file) {
    await uploadTime();
    const self = requireMe();
    settlePending();
    const word = todaysWords().find((w) => w.id === wordId);
    if (!word) throw new ApiError(404, 'word_not_found', 'This word is no longer active.');
    if (word.difficulty === 'expert' && !self.isPremium) {
      throw new ApiError(403, 'premium_required', 'The Premium word is part of Premium.');
    }
    if (myValidSubmission(wordId)) throw new ApiError(409, 'already_found', 'You already found this one today.');
    if (myPendingSubmission(wordId)) {
      throw new ApiError(409, 'submission_pending', "We're still checking your last photo for this word.");
    }

    const valid = Math.random() < 0.6;
    const hours = (Date.now() - state.dayStart) / 3_600_000;
    const max = MAX_POINTS[word.difficulty];
    const points = valid ? Math.max(Math.round(max * 0.2), Math.round(max * (1 - hours / 24))) : 0;
    const pending: Submission = {
      id: `s${Date.now()}`,
      wordId,
      status: 'pending',
      points: 0,
      comboPoints: 0,
      rank: null,
      confidence: null,
      message: null,
      imageUrl: file.uri,
      createdAt: new Date().toISOString(),
    };
    state.verdicts.set(pending.id, {
      at: Date.now() + INFERENCE_MS,
      result: {
        ...pending,
        status: valid ? 'valid' : 'invalid',
        points,
        rank: valid ? foundCountFor(word.difficulty) + 1 : null,
        confidence: valid ? 0.82 + Math.random() * 0.15 : 0.1 + Math.random() * 0.3,
        message: valid ? null : `We couldn't spot a ${word.word} in this photo. Get closer and make sure it's in focus.`,
      },
    });
    state.mySubmissions.push(pending);
    return pending;
  },
  async getSubmission(id) {
    await latency();
    settlePending();
    const s = state.mySubmissions.find((x) => x.id === id);
    if (!s) throw new ApiError(404, 'not_found', 'Submission not found');
    return s;
  },

  async getLeaderboard({ scope, cursor }) {
    await latency();
    const self = requireMe();
    settlePending();
    const all = leaderboardEntries(scope);
    const start = Number(cursor ?? 0);
    const now = new Date();
    return {
      month: now.toISOString().slice(0, 7),
      resetsAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString(),
      entries: all.slice(start, start + PAGE_SIZE),
      me: all.find((e) => e.user.id === self.id) ?? null,
      nextCursor: start + PAGE_SIZE < all.length ? String(start + PAGE_SIZE) : null,
    };
  },

  async getFeedToday() {
    await latency();
    return others
      .filter((o) => state.friends.has(o.id) && !state.blocked.has(o.id))
      .flatMap(feedFor)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async getFriendRequests() {
    await latency();
    return state.incoming.filter((r) => !state.blocked.has(r.from.id));
  },
  async sendFriendRequest(userId) {
    await latency();
    if (friendStatus(userId) === 'incoming') {
      state.incoming = state.incoming.filter((r) => r.from.id !== userId);
      state.friends.add(userId);
      return;
    }
    state.outgoing.set(userId, `o${Date.now()}`);
  },
  async respondFriendRequest(requestId, action) {
    await latency();
    const req = state.incoming.find((r) => r.id === requestId);
    state.incoming = state.incoming.filter((r) => r.id !== requestId);
    if (req && action === 'accept') state.friends.add(req.from.id);
  },
  async removeFriend(userId) {
    await latency();
    state.friends.delete(userId);
    state.outgoing.delete(userId);
  },
  async searchUsers(q) {
    await latency();
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return others
      .filter((o) => o.username?.includes(needle) && !state.blocked.has(o.id))
      .map((o) => ({ user: o, friendStatus: friendStatus(o.id) }));
  },
  async getUserProfile(userId) {
    await latency();
    const self = requireMe();
    if (userId === self.id) return profileFor(self, true);
    const u = others.find((o) => o.id === userId);
    if (!u) throw new ApiError(404, 'not_found', 'User not found');
    return profileFor(u, false);
  },

  async report() {
    await latency();
  },
  async blockUser(userId) {
    await latency();
    state.blocked.add(userId);
    state.friends.delete(userId);
    state.outgoing.delete(userId);
    state.incoming = state.incoming.filter((r) => r.from.id !== userId);
  },
  async unblockUser(userId) {
    await latency();
    state.blocked.delete(userId);
  },
  async getBlockedUsers() {
    await latency();
    const blockedAt = new Date().toISOString();
    return others.filter((o) => state.blocked.has(o.id)).map((user) => ({ user, blockedAt }));
  },
};
