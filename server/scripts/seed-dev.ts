/**
 * Fill the local dev database with test players: friends, friend requests both ways, strangers on the
 * global board, points spread over this month, and today's finds with photos for the feed.
 *
 *   npm run seed:dev            # relationships are with the dev-login user "alex"
 *   npm run seed:dev -- maya    # ...or with another dev-login name
 *
 * Every seeded player is a dev-login user, so the app can sign in as any of them (EXPO_PUBLIC_DEV_LOGIN).
 * Safe to run twice: existing players and relationships are kept, and only new players get finds.
 * Stop the dev server first: PGlite allows one process at a time.
 */
import { createHash, randomUUID } from 'node:crypto';
import { connect } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { and, eq, gte, lte, sql } from 'drizzle-orm';
import sharp from 'sharp';

import type { Difficulty } from '@shared/types';

import { openDatabase } from '../src/db/client';
import { dailyWords, friendRequests, friendships, submissions, users, words, type UserRow } from '../src/db/schema';
import { difficulties } from '../src/domain/enums';
import { loadEnv } from '../src/env';
import { pair } from '../src/services/relationships';
import { pointsFor } from '../src/services/scoring';
import { localStorage } from '../src/services/storage';
import { seedWords } from '../src/seed/words';

type Relation = 'friend' | 'incoming' | 'outgoing' | 'none';
type Player = {
  name: string;
  relation: Relation;
  /** Chance of finding each word on a given day: how high they land on the board. */
  activity: number;
  premium?: boolean;
  /** Give them a photo avatar instead of their initial. */
  photo?: string;
  /** Months since they joined. */
  joined: number;
};

const PLAYERS: Player[] = [
  { name: 'maya_k', relation: 'friend', activity: 0.9, premium: true, photo: '#B79A7A', joined: 8 },
  { name: 'jordan', relation: 'friend', activity: 0.6, photo: '#7E9BAE', joined: 5 },
  { name: 'sam', relation: 'friend', activity: 0.4, joined: 3 },
  { name: 'pip', relation: 'friend', activity: 0.15, joined: 1 },
  { name: 'riley', relation: 'incoming', activity: 0.7, joined: 4 },
  { name: 'kim', relation: 'incoming', activity: 0.5, photo: '#8FA38A', joined: 2 },
  { name: 'morgan', relation: 'outgoing', activity: 0.65, photo: '#A98A9B', joined: 6 },
  { name: 'lucky_lens', relation: 'none', activity: 0.95, premium: true, joined: 10 },
  { name: 'snapjack', relation: 'none', activity: 0.85, joined: 9 },
  { name: 'owl_eyes', relation: 'none', activity: 0.75, photo: '#7E9BAE', joined: 7 },
  { name: 'taylor', relation: 'none', activity: 0.55, premium: true, joined: 6 },
  { name: 'quinn_h', relation: 'none', activity: 0.45, joined: 4 },
  { name: 'bea', relation: 'none', activity: 0.35, photo: '#B79A7A', joined: 2 },
  { name: 'tomasz', relation: 'none', activity: 0.25, joined: 1 },
  { name: 'noor', relation: 'none', activity: 0.1, joined: 0 },
];

const TILE: Record<Difficulty, string> = { easy: '#2FB344', medium: '#2D9CDB', hard: '#F0524F', expert: '#9B5DE5' };

const SERVER_ROOT = fileURLToPath(new URL('..', import.meta.url));
const env = loadEnv();
const me = process.argv[2] ?? 'alex';

if (env.NODE_ENV === 'production') throw new Error('Refusing to seed a production database.');
if (!/^[a-z0-9_]{3,20}$/.test(me)) throw new Error(`"${me}" isn't a valid username.`);
if (!env.DATABASE_URL && (await portInUse(env.PORT))) {
  console.error(`Something is listening on port ${env.PORT}. Stop the dev server first (PGlite allows one process).`);
  process.exit(1);
}

const dataDir = path.resolve(SERVER_ROOT, env.DATA_DIR);
const database = await openDatabase({ databaseUrl: env.DATABASE_URL, dataDir });
const db = database.db;
const storage = localStorage({
  dir: path.join(dataDir, 'uploads'),
  baseUrl: env.PUBLIC_BASE_URL,
  secret: env.FILE_URL_SECRET,
  now: () => new Date(),
});

try {
  await seedWords(db);
  const now = new Date();
  const days = monthDaysSoFar(now);
  const slots = await ensureSchedule(days);

  const self = await ensureUser(me, { joined: 3 });
  let created = 0;
  for (const p of PLAYERS) {
    if (p.name === me) continue;
    const { user, isNew } = await ensureUserTracked(p.name, p);
    if (isNew) {
      created++;
      await addFinds(user, p, slots, now);
    }
    await relate(self.id, user.id, p.relation);
  }
  await numberFinders(days);

  const summary = PLAYERS.filter((p) => p.name !== me).reduce<Record<Relation, string[]>>(
    (acc, p) => ({ ...acc, [p.relation]: [...acc[p.relation], p.name] }),
    { friend: [], incoming: [], outgoing: [], none: [] },
  );
  console.log(`Seeded ${created} new players (${PLAYERS.length - created} already existed) around "${me}".`);
  console.log(`  friends:            ${summary.friend.join(', ')}`);
  console.log(`  asked ${me}:${' '.repeat(Math.max(1, 13 - me.length))}${summary.incoming.join(', ')}`);
  console.log(`  ${me} asked:${' '.repeat(Math.max(1, 13 - me.length))}${summary.outgoing.join(', ')}`);
  console.log(`  strangers:          ${summary.none.join(', ')}`);
} finally {
  await database.close();
}

// ---- helpers ----------------------------------------------------------------

function portInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ port, host: '127.0.0.1' });
    socket.once('connect', () => (socket.destroy(), resolve(true)));
    socket.once('error', () => resolve(false));
  });
}

/** YYYY-MM-DD for the 1st of this UTC month up to today. */
function monthDaysSoFar(now: Date): string[] {
  const out: string[] = [];
  for (let d = 1; d <= now.getUTCDate(); d++) {
    out.push(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), d)).toISOString().slice(0, 10));
  }
  return out;
}

type Slot = { id: string; date: string; difficulty: Difficulty; label: string };

/** Make sure every day so far this month has a word per difficulty, without touching planned days. */
async function ensureSchedule(days: string[]): Promise<Slot[]> {
  const pool = await db.select().from(words).where(eq(words.enabled, true));
  for (const [i, date] of days.entries()) {
    for (const difficulty of difficulties) {
      const options = pool.filter((w) => w.difficulty === difficulty);
      if (!options.length) continue;
      const word = options[(i * 7 + difficulties.indexOf(difficulty) * 3) % options.length]!;
      await db.insert(dailyWords).values({ date, difficulty, wordId: word.id }).onConflictDoNothing();
    }
  }
  return db
    .select({ id: dailyWords.id, date: dailyWords.date, difficulty: dailyWords.difficulty, label: words.label })
    .from(dailyWords)
    .innerJoin(words, eq(words.id, dailyWords.wordId))
    .where(and(gte(dailyWords.date, days[0]!), lte(dailyWords.date, days.at(-1)!)));
}

async function ensureUser(name: string, p: Pick<Player, 'joined' | 'premium' | 'photo'>): Promise<UserRow> {
  return (await ensureUserTracked(name, p)).user;
}

async function ensureUserTracked(
  name: string,
  p: Pick<Player, 'joined' | 'premium' | 'photo'>,
): Promise<{ user: UserRow; isNew: boolean }> {
  const [existing] = await db
    .select()
    .from(users)
    .where(and(eq(users.provider, 'dev'), eq(users.providerSub, name)));
  if (existing) {
    // A dev user who signed in but never picked a username: give them theirs.
    if (!existing.username) {
      const [named] = await db.update(users).set({ username: name }).where(eq(users.id, existing.id)).returning();
      return { user: named!, isNew: false };
    }
    return { user: existing, isNew: false };
  }
  const joined = new Date();
  joined.setUTCMonth(joined.getUTCMonth() - p.joined);
  const [user] = await db
    .insert(users)
    .values({
      provider: 'dev',
      providerSub: name,
      username: name,
      displayName: name,
      isPremium: !!p.premium,
      createdAt: joined,
    })
    .returning();
  if (p.photo) {
    const key = `${user!.id}/avatar-${randomUUID()}.jpg`;
    await storage.put(key, await avatarJpeg(p.photo, name));
    const [withAvatar] = await db.update(users).set({ avatarKey: key }).where(eq(users.id, user!.id)).returning();
    return { user: withAvatar!, isNew: true };
  }
  return { user: user!, isNew: true };
}

/** Valid finds on random days so far this month; today's get a photo so they show in the feed. */
async function addFinds(user: UserRow, p: Player, slots: Slot[], now: Date) {
  const random = seeded(user.username ?? user.id);
  const today = now.toISOString().slice(0, 10);
  for (const slot of slots) {
    if (slot.difficulty === 'expert' && !p.premium) continue;
    if (random() > p.activity) continue;
    const dayStart = Date.parse(`${slot.date}T00:00:00Z`);
    const latest = slot.date === today ? now.getTime() - 60_000 : dayStart + 86_399_000;
    if (latest <= dayStart) continue;
    // Busy players find words early in the day, which is worth more.
    const receivedAt = new Date(dayStart + (latest - dayStart) * random() * (1.2 - p.activity));
    const id = randomUUID();
    let imageKey: string | null = null;
    if (slot.date === today) {
      imageKey = `${user.id}/${id}.jpg`;
      await storage.put(imageKey, await findJpeg(slot.label, slot.difficulty, user.username ?? ''));
    }
    await db.insert(submissions).values({
      id,
      userId: user.id,
      dailyWordId: slot.id,
      status: 'valid',
      points: pointsFor(slot.difficulty, receivedAt),
      confidence: 0.9,
      imageKey,
      imageSha256: createHash('sha256').update(id).digest('hex'),
      receivedAt,
      decidedAt: new Date(receivedAt.getTime() + 4_000),
    });
  }
}

async function relate(meId: string, otherId: string, relation: Relation) {
  if (relation === 'friend') {
    await db.insert(friendships).values(pair(meId, otherId)).onConflictDoNothing();
  } else if (relation === 'incoming' || relation === 'outgoing') {
    const [friends] = await db
      .select()
      .from(friendships)
      .where(and(eq(friendships.userA, pair(meId, otherId).userA), eq(friendships.userB, pair(meId, otherId).userB)));
    if (friends) return; // they became friends since the last seed; leave it
    const [fromId, toId] = relation === 'incoming' ? [otherId, meId] : [meId, otherId];
    await db.insert(friendRequests).values({ fromId, toId }).onConflictDoNothing();
  }
}

/** Finder numbers ("28th finder") follow the order photos arrived, per word. */
async function numberFinders(days: string[]) {
  const ids = (
    await db
      .select({ id: dailyWords.id })
      .from(dailyWords)
      .where(and(gte(dailyWords.date, days[0]!), lte(dailyWords.date, days.at(-1)!)))
  ).map((r) => r.id);
  if (!ids.length) return;
  await db.execute(sql`
    UPDATE submissions s SET rank = r.n
    FROM (
      SELECT id, row_number() OVER (PARTITION BY daily_word_id ORDER BY received_at) AS n
      FROM submissions WHERE status = 'valid' AND daily_word_id IN (${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)})
    ) r
    WHERE s.id = r.id`);
}

/** A coloured card with the word on it, standing in for a real photo (4:3, like the camera). */
async function findJpeg(label: string, difficulty: Difficulty, by: string): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
    <rect width="800" height="600" fill="${TILE[difficulty]}"/>
    <circle cx="640" cy="140" r="90" fill="#FFFFFF" opacity="0.18"/>
    <text x="400" y="320" font-family="sans-serif" font-size="72" font-weight="900" fill="#FFFFFF" text-anchor="middle">${escapeXml(label.toUpperCase())}</text>
    <text x="400" y="390" font-family="sans-serif" font-size="32" fill="#FFFFFF" opacity="0.85" text-anchor="middle">found by ${escapeXml(by)}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 80 }).toBuffer();
}

async function avatarJpeg(color: string, name: string): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">
    <rect width="256" height="256" fill="${color}"/>
    <circle cx="128" cy="104" r="46" fill="#FFFFFF" opacity="0.8"/>
    <path d="M44 256a84 78 0 0 1 168 0z" fill="#FFFFFF" opacity="0.8"/>
    <text x="230" y="40" font-family="sans-serif" font-size="28" font-weight="900" fill="#FFFFFF" text-anchor="end">${escapeXml(name.charAt(0).toUpperCase())}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toBuffer();
}

function escapeXml(s: string) {
  return s.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Same numbers for the same player on every run, so a reseed after a wipe looks the same. */
function seeded(key: string) {
  let h = createHash('sha256').update(key).digest().readUInt32LE(0) || 1;
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return (h >>> 0) / 4_294_967_296;
  };
}
