import type { Difficulty, User } from '@/api/types';

/** Fixed data of the fake backend: word pools, points and the other players. */

export const WORD_POOLS: Record<Difficulty, string[]> = {
  easy: ['chair', 'cup', 'bottle', 'book', 'shoe', 'clock', 'car', 'plant'],
  medium: ['umbrella', 'bicycle', 'backpack', 'scissors', 'teddy bear', 'toaster', 'kite', 'vase'],
  hard: ['fire hydrant', 'stop sign', 'parking meter', 'giraffe', 'skateboard', 'surfboard', 'tennis racket', 'hair drier'],
  expert: ['zebra', 'snowboard', 'microwave', 'traffic light', 'frisbee', 'baseball glove', 'elephant', 'sailboat'],
};
export const MAX_POINTS: Record<Difficulty, number> = { easy: 100, medium: 250, hard: 500, expert: 1000 };
export const FREE_DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];
export const ALL_DIFFICULTIES: Difficulty[] = [...FREE_DIFFICULTIES, 'expert'];

/** How long the fake YOLO queue takes to judge a photo. */
export const INFERENCE_MS = 2500;
export const PAGE_SIZE = 20;

export const mockUser = (id: string, username: string | null): User => ({
  id,
  username,
  displayName: null,
  avatarUrl: null,
  isPremium: false,
  // Spread the fake players' join dates over the past months ("u3" joined earlier than "u1").
  joinedAt: new Date(Date.now() - ((Number(id.replace(/\D/g, '')) || 0) * 47 + 3) * 86_400_000).toISOString(),
});

export const others: User[] = [
  mockUser('u1', 'alex'),
  mockUser('u2', 'sam'),
  mockUser('u3', 'jordan'),
  mockUser('u4', 'taylor'),
  mockUser('u5', 'riley'),
  mockUser('u6', 'morgan'),
];

/** A stable small number per fake user ("u3" → 3), used to vary their made-up stats. */
export const userSeed = (u: User) => Number(u.id.slice(1));

export const photo = (seed: string) => `https://picsum.photos/seed/${encodeURIComponent(seed)}/600/800`;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** A typical API round trip. */
export const latency = () => wait(250 + Math.random() * 350);
/** A photo upload. */
export const uploadTime = () => wait(800 + Math.random() * 400);
