import type { Difficulty } from '@/api/types';

/** What players see. The keys stay `easy/medium/hard/expert` because they're the API contract. */
export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Rookie',
  medium: 'Scout',
  hard: 'Ranger',
  expert: 'Premium',
};

/** 3725s -> "01:02:05" */
export function formatCountdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

export function timeAgo(iso: string) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function daysUntil(iso: string) {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

export function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

export function displayName(u: { username: string | null; displayName: string | null }) {
  return u.username ? `@${u.username}` : (u.displayName ?? 'Player');
}

export function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : 'Something went wrong. Please try again.';
}
