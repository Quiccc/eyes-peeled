import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { difficulties, reportReasons, reportStatuses, submissionStatuses } from '../domain/enums';

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: text('provider', { enum: ['apple', 'google', 'dev'] }).notNull(),
    providerSub: text('provider_sub').notNull(),
    username: text('username'),
    displayName: text('display_name'),
    avatarUrl: text('avatar_url'),
    isPremium: boolean('is_premium').notNull().default(false),
    bannedAt: timestamp('banned_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('users_provider_sub_idx').on(t.provider, t.providerSub),
    uniqueIndex('users_username_idx').on(t.username),
  ],
);

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('refresh_tokens_hash_idx').on(t.tokenHash)],
);


export const words = pgTable(
  'words',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** The object to find: what players see and what Claude looks for in the photo */
    label: text('label').notNull(),
    difficulty: text('difficulty', { enum: difficulties }).notNull(),
    /** Retired words stay for history but are never scheduled again. */
    enabled: boolean('enabled').notNull().default(true),
    /** Per-word pass threshold; null = VERIFY_MIN_CONFIDENCE. */
    minConfidence: real('min_confidence'),
  },
  (t) => [uniqueIndex('words_label_difficulty_idx').on(t.label, t.difficulty)],
);

export const dailyWords = pgTable(
  'daily_words',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** UTC date, YYYY-MM-DD */
    date: date('date', { mode: 'string' }).notNull(),
    difficulty: text('difficulty', { enum: difficulties }).notNull(),
    wordId: uuid('word_id')
      .notNull()
      .references(() => words.id),
  },
  (t) => [uniqueIndex('daily_words_date_difficulty_idx').on(t.date, t.difficulty)],
);

export const submissions = pgTable(
  'submissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    dailyWordId: uuid('daily_word_id')
      .notNull()
      .references(() => dailyWords.id),
    status: text('status', { enum: submissionStatuses }).notNull(),
    points: integer('points').notNull().default(0),
    /** Combo bonus this find added by linking to an adjacent trail node (see services/combos.ts). */
    comboPoints: integer('combo_points').notNull().default(0),
    rank: integer('rank'),
    confidence: real('confidence'),
    message: text('message'),
    /** Null for exact duplicates: their photo is never stored. */
    imageKey: text('image_key'),
    imageSha256: text('image_sha256').notNull(),
    /** Server receipt time. This decides the score. */
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
  },
  (t) => [
    // At most one valid find per user per word.
    uniqueIndex('submissions_one_valid_idx').on(t.userId, t.dailyWordId).where(sql`${t.status} = 'valid'`),
    index('submissions_word_status_idx').on(t.dailyWordId, t.status),
    index('submissions_user_received_idx').on(t.userId, t.receivedAt),
    index('submissions_sha_idx').on(t.imageSha256),
  ],
);

export const friendRequests = pgTable(
  'friend_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fromId: uuid('from_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    toId: uuid('to_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('friend_requests_pair_idx').on(t.fromId, t.toId)],
);

/** One row per friendship, stored with userA < userB. */
export const friendships = pgTable(
  'friendships',
  {
    userA: uuid('user_a')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    userB: uuid('user_b')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userA, t.userB] }), check('friendships_order', sql`${t.userA} < ${t.userB}`)],
);

export const blocks = pgTable(
  'blocks',
  {
    blockerId: uuid('blocker_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    blockedId: uuid('blocked_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.blockerId, t.blockedId] })],
);

export const reports = pgTable('reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  reporterId: uuid('reporter_id').references(() => users.id, { onDelete: 'set null' }),
  submissionId: uuid('submission_id').references(() => submissions.id, { onDelete: 'set null' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  reason: text('reason', { enum: reportReasons }).notNull(),
  status: text('status', { enum: reportStatuses }).notNull().default('open'),
  createdAt: createdAt(),
});

export type UserRow = typeof users.$inferSelect;
export type SubmissionRow = typeof submissions.$inferSelect;
export type WordRow = typeof words.$inferSelect;
