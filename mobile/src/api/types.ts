/**
 * Shared API types. These mirror the REST contract in docs/api-contract.md —
 * keep both in sync when the backend changes.
 */

/** 'expert' is the premium-only 4th daily word. */
export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

export type User = {
  id: string;
  /** null until the user picks one on first login */
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  /** Bought the one-time Premium purchase (no ads + the daily Premium word). Set by the server only. */
  isPremium: boolean;
  /** When the account was created (ISO 8601). Shown as "Hunting since November". */
  joinedAt: string;
};

export type AuthProvider = 'apple' | 'google';

export type AuthRequest = {
  provider: AuthProvider;
  /** Apple identityToken or Google idToken */
  idToken: string;
  /** Apple only sends the name on first sign-in; forward it so the backend can store it */
  fullName?: string | null;
};

/** Optional body of DELETE /me. */
export type DeleteAccountRequest = {
  /**
   * Apple accounts: a fresh `authorizationCode` from Sign in with Apple (valid ~5 minutes, one use).
   * The server trades it for a token and revokes it, as Apple requires on account deletion.
   */
  appleAuthorizationCode?: string;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type AuthResponse = AuthTokens & {
  user: User;
  isNewUser: boolean;
};

export type SubmissionStatus = 'pending' | 'valid' | 'invalid';

export type Submission = {
  id: string;
  wordId: string;
  status: SubmissionStatus;
  /** 0 unless valid */
  points: number;
  /**
   * Combo bonus this find added by linking to an adjacent trail node that is also found
   * (1st link of the day +50, 2nd +100, 3rd +200). 0 unless valid. Not part of `points`.
   */
  comboPoints: number;
  /** Order in which this valid photo arrived for the word (1 = first finder). null unless valid. */
  rank: number | null;
  /** AI confidence 0–1 that the object is in the photo, informational */
  confidence: number | null;
  /** Human-readable explanation, mainly for invalid results */
  message: string | null;
  imageUrl: string | null;
  /** Server timestamp, ISO 8601 */
  createdAt: string;
};

export type DailyWord = {
  id: string;
  difficulty: Difficulty;
  word: string;
  /** Points awarded to the very first valid photo */
  maxPoints: number;
  /** How many players have found it so far today */
  foundCount: number;
  /** When the first valid photo of it was received today (ISO 8601); null while nobody has found it. */
  firstFoundAt: string | null;
  /** 'pending' = the user has a photo still being checked (e.g. they closed the app mid-analysis). */
  status: 'open' | 'pending' | 'found';
  /** The user's valid submission when 'found', or the in-flight one when 'pending'. null when 'open'. */
  submission: Submission | null;
};

export type Daily = {
  /** UTC date, YYYY-MM-DD */
  date: string;
  /** ISO 8601 instant of the next UTC reset */
  nextResetAt: string;
  words: DailyWord[];
};

export type LeaderboardScope = 'global' | 'friends';

export type LeaderboardEntry = {
  rank: number;
  user: User;
  points: number;
};

export type Leaderboard = {
  /** YYYY-MM */
  month: string;
  /** ISO 8601 instant of the monthly wipe */
  resetsAt: string;
  entries: LeaderboardEntry[];
  /** The signed-in user's own entry (null if no points this month) */
  me: LeaderboardEntry | null;
  nextCursor: string | null;
};

export type FeedItem = {
  submissionId: string;
  user: User;
  word: string;
  difficulty: Difficulty;
  points: number;
  rank: number | null;
  imageUrl: string;
  createdAt: string;
};

export type FriendStatus = 'none' | 'friends' | 'outgoing' | 'incoming' | 'blocked';

export type FriendRequest = {
  id: string;
  from: User;
  createdAt: string;
};

/** GET /blocks: a player the current user blocked. */
export type BlockedUser = {
  user: User;
  blockedAt: string;
};

export type UserSearchResult = {
  user: User;
  friendStatus: FriendStatus;
};

export type UserProfile = {
  user: User;
  friendStatus: FriendStatus;
  /** id of the pending request, when friendStatus is 'incoming' or 'outgoing' */
  requestId: string | null;
  monthPoints: number;
  monthRank: number | null;
  streak: number;
  totalFinds: number;
  /** Today's valid uploads — only visible when friends (or self) */
  today: FeedItem[];
};

export type ReportReason = 'inappropriate' | 'spam' | 'cheating' | 'other';

export type ApiErrorBody = {
  code: string;
  message: string;
};
