/**
 * In-memory fake backend so the app can be built and demoed before the real
 * backend + YOLO service exist. Enabled when EXPO_PUBLIC_USE_MOCK_API=true or
 * no EXPO_PUBLIC_API_URL is set. State resets when the JS bundle reloads.
 */
import { ApiError } from './client';
import type { Api } from './endpoints';
import type {
  Difficulty,
  FeedItem,
  FriendRequest,
  FriendStatus,
  LeaderboardEntry,
  Submission,
  User,
  UserProfile,
} from './types';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const latency = () => wait(250 + Math.random() * 350);

const WORD_POOLS: Record<Difficulty, string[]> = {
  easy: ['chair', 'cup', 'bottle', 'book', 'shoe', 'clock', 'car', 'plant'],
  medium: ['umbrella', 'bicycle', 'backpack', 'scissors', 'teddy bear', 'toaster', 'kite', 'vase'],
  hard: ['fire hydrant', 'stop sign', 'parking meter', 'giraffe', 'skateboard', 'surfboard', 'tennis racket', 'hair drier'],
};
const MAX_POINTS: Record<Difficulty, number> = { easy: 100, medium: 250, hard: 500 };
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

const user = (id: string, username: string): User => ({ id, username, displayName: null, avatarUrl: null });
const others: User[] = [
  user('u1', 'alex'),
  user('u2', 'sam'),
  user('u3', 'jordan'),
  user('u4', 'taylor'),
  user('u5', 'riley'),
  user('u6', 'morgan'),
];

let me: User | null = null;
const friends = new Set(['u1', 'u2', 'u3']);
const blocked = new Set<string>();
const outgoing = new Map<string, string>(); // userId -> requestId
let incoming: FriendRequest[] = [{ id: 'r1', from: others[4], createdAt: new Date().toISOString() }];

// ---- virtual day / reset clock ---------------------------------------------
const resetEverySec = Number(process.env.EXPO_PUBLIC_MOCK_RESET_IN_SECONDS) || 0;
let dayIndex = Math.floor(Date.now() / 86_400_000);
let dayStart = dayIndex * 86_400_000;
let resetAt = resetEverySec ? Date.now() + resetEverySec * 1000 : dayStart + 86_400_000;
let mySubmissions: Submission[] = [];
let monthPoints = 0;
let totalFinds = 0;

function rollDay() {
  if (Date.now() < resetAt) return;
  dayIndex += 1;
  dayStart = Date.now();
  resetAt = resetEverySec ? Date.now() + resetEverySec * 1000 : Math.floor(Date.now() / 86_400_000 + 1) * 86_400_000;
  mySubmissions = [];
}

function todaysWords() {
  return DIFFICULTIES.map((difficulty, i) => {
    const pool = WORD_POOLS[difficulty];
    return {
      id: `${dayIndex}-${difficulty}`,
      difficulty,
      word: pool[(dayIndex * 7 + i * 3) % pool.length],
    };
  });
}

function foundCountFor(difficulty: Difficulty) {
  const hours = (Date.now() - dayStart) / 3_600_000;
  const base = { easy: 900, medium: 260, hard: 45 }[difficulty];
  return Math.floor(base * Math.min(1, hours / 12 + 0.1));
}

function myValidSubmission(wordId: string) {
  return mySubmissions.find((s) => s.wordId === wordId && s.status === 'valid') ?? null;
}

function requireMe(): User {
  if (!me) throw new ApiError(401, 'unauthorized', 'Not signed in');
  return me;
}

function photo(seed: string) {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/600/800`;
}

function feedFor(u: User): FeedItem[] {
  return todaysWords()
    .filter((_, i) => (Number(u.id.slice(1)) + i + dayIndex) % 3 !== 0)
    .map((w, i) => ({
      submissionId: `${u.id}-${w.id}`,
      user: u,
      word: w.word,
      difficulty: w.difficulty,
      points: Math.round(MAX_POINTS[w.difficulty] * (0.5 + 0.1 * i)),
      rank: 10 + i * 17 + Number(u.id.slice(1)),
      imageUrl: photo(`${u.id}-${w.id}`),
      createdAt: new Date(dayStart + (i + 1) * 3_600_000).toISOString(),
    }));
}

function friendStatus(userId: string): FriendStatus {
  if (blocked.has(userId)) return 'blocked';
  if (friends.has(userId)) return 'friends';
  if (outgoing.has(userId)) return 'outgoing';
  if (incoming.some((r) => r.from.id === userId)) return 'incoming';
  return 'none';
}

function leaderboardEntries(scope: 'global' | 'friends'): LeaderboardEntry[] {
  const self = requireMe();
  const pool: { user: User; points: number }[] = [];
  if (scope === 'global') {
    for (let i = 0; i < 60; i++) {
      pool.push({ user: user(`g${i}`, `hunter${i + 1}`), points: Math.max(0, 9000 - i * 140 - (i % 7) * 13) });
    }
  }
  for (const o of others) {
    if (scope === 'friends' && !friends.has(o.id)) continue;
    pool.push({ user: o, points: 1500 + Number(o.id.slice(1)) * 377 });
  }
  if (monthPoints > 0 || scope === 'friends') pool.push({ user: self, points: monthPoints });
  return pool
    .filter((p) => !blocked.has(p.user.id))
    .sort((a, b) => b.points - a.points)
    .map((p, i) => ({ ...p, rank: i + 1 }));
}

function profileFor(u: User, isSelf: boolean): UserProfile {
  const status = isSelf ? 'friends' : friendStatus(u.id);
  const entry = leaderboardEntries('global').find((e) => e.user.id === u.id) ?? null;
  const reqId = outgoing.get(u.id) ?? incoming.find((r) => r.from.id === u.id)?.id ?? null;
  return {
    user: u,
    friendStatus: status,
    requestId: reqId,
    monthPoints: entry?.points ?? 0,
    monthRank: entry?.rank ?? null,
    streak: isSelf ? (totalFinds > 0 ? 1 : 0) : 3 + Number(u.id.slice(1)),
    totalFinds: isSelf ? totalFinds : 20 + Number(u.id.slice(1)) * 4,
    today: isSelf
      ? mySubmissions
          .filter((s) => s.status === 'valid')
          .map((s) => {
            const w = todaysWords().find((x) => x.id === s.wordId)!;
            return {
              submissionId: s.id,
              user: u,
              word: w.word,
              difficulty: w.difficulty,
              points: s.points,
              rank: s.rank,
              imageUrl: s.imageUrl ?? '',
              createdAt: s.createdAt,
            };
          })
      : status === 'friends'
        ? feedFor(u)
        : [],
  };
}

export const mockApi: Api = {
  async signIn() {
    await latency();
    const isNewUser = !me;
    me ??= { id: 'me', username: null, displayName: null, avatarUrl: null };
    return { accessToken: 'mock-access', refreshToken: 'mock-refresh', user: me, isNewUser };
  },
  async signOut() {
    await latency();
  },
  async getMe() {
    await latency();
    // A restored session after reload: recreate the user so the app can continue.
    me ??= { id: 'me', username: 'you', displayName: null, avatarUrl: null };
    return me;
  },
  async updateMe({ username }) {
    await latency();
    const self = requireMe();
    const clean = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(clean)) {
      throw new ApiError(400, 'invalid_username', 'Use 3–20 letters, numbers or underscores.');
    }
    if (others.some((o) => o.username === clean)) {
      throw new ApiError(409, 'username_taken', 'That username is taken.');
    }
    me = { ...self, username: clean };
    return me;
  },
  async deleteMe() {
    await latency();
    me = null;
    mySubmissions = [];
    monthPoints = 0;
    totalFinds = 0;
  },
  async getMyProfile() {
    await latency();
    return profileFor(requireMe(), true);
  },

  async getDaily() {
    await latency();
    requireMe();
    rollDay();
    return {
      date: new Date(dayStart).toISOString().slice(0, 10),
      nextResetAt: new Date(resetAt).toISOString(),
      words: todaysWords().map((w) => {
        const sub = myValidSubmission(w.id);
        return {
          ...w,
          maxPoints: MAX_POINTS[w.difficulty],
          foundCount: foundCountFor(w.difficulty),
          status: sub ? 'found' : 'open',
          submission: sub,
        };
      }),
    };
  },

  async submitPhoto(wordId, file) {
    await wait(1200 + Math.random() * 800); // upload + inference
    requireMe();
    const word = todaysWords().find((w) => w.id === wordId);
    if (!word) throw new ApiError(404, 'word_not_found', 'This word is no longer active.');
    if (myValidSubmission(wordId)) throw new ApiError(409, 'already_found', 'You already found this one today.');

    const valid = Math.random() < 0.6;
    const hours = (Date.now() - dayStart) / 3_600_000;
    const max = MAX_POINTS[word.difficulty];
    const points = valid ? Math.max(Math.round(max * 0.2), Math.round(max * (1 - hours / 24))) : 0;
    const submission: Submission = {
      id: `s${Date.now()}`,
      wordId,
      status: valid ? 'valid' : 'invalid',
      points,
      rank: valid ? foundCountFor(word.difficulty) + 1 : null,
      confidence: valid ? 0.82 + Math.random() * 0.15 : 0.1 + Math.random() * 0.3,
      message: valid ? null : `We couldn't spot a ${word.word} in this photo. Get closer and make sure it's in focus.`,
      imageUrl: file.uri,
      createdAt: new Date().toISOString(),
    };
    mySubmissions.push(submission);
    if (valid) {
      monthPoints += points;
      totalFinds += 1;
    }
    return submission;
  },
  async getSubmission(id) {
    await latency();
    const s = mySubmissions.find((x) => x.id === id);
    if (!s) throw new ApiError(404, 'not_found', 'Submission not found');
    return s;
  },

  async getLeaderboard({ scope, cursor }) {
    await latency();
    const self = requireMe();
    const all = leaderboardEntries(scope);
    const start = Number(cursor ?? 0);
    const page = all.slice(start, start + 20);
    const now = new Date();
    return {
      month: now.toISOString().slice(0, 7),
      resetsAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString(),
      entries: page,
      me: all.find((e) => e.user.id === self.id) ?? null,
      nextCursor: start + 20 < all.length ? String(start + 20) : null,
    };
  },

  async getFeedToday() {
    await latency();
    return others
      .filter((o) => friends.has(o.id) && !blocked.has(o.id))
      .flatMap(feedFor)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async getFriendRequests() {
    await latency();
    return incoming.filter((r) => !blocked.has(r.from.id));
  },
  async sendFriendRequest(userId) {
    await latency();
    if (friendStatus(userId) === 'incoming') {
      incoming = incoming.filter((r) => r.from.id !== userId);
      friends.add(userId);
      return;
    }
    outgoing.set(userId, `o${Date.now()}`);
  },
  async respondFriendRequest(requestId, action) {
    await latency();
    const req = incoming.find((r) => r.id === requestId);
    incoming = incoming.filter((r) => r.id !== requestId);
    if (req && action === 'accept') friends.add(req.from.id);
  },
  async removeFriend(userId) {
    await latency();
    friends.delete(userId);
    outgoing.delete(userId);
  },
  async searchUsers(q) {
    await latency();
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return others
      .filter((o) => o.username?.includes(needle) && !blocked.has(o.id))
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
    blocked.add(userId);
    friends.delete(userId);
    outgoing.delete(userId);
    incoming = incoming.filter((r) => r.from.id !== userId);
  },
};
