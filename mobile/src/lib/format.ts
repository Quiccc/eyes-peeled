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

/** 1234 -> "1,234" in the player's locale. */
export function formatNumber(n: number) {
  return n.toLocaleString();
}

/** 1 -> "1 day", 3 -> "3 days" */
export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/** Words are shown in capitals everywhere: cards, camera badge, share card. */
export function displayWord(word: string) {
  return word.toUpperCase();
}

/** "June" for "2026-06" (leaderboard month, always UTC). */
export function monthName(month: string) {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString(undefined, { month: 'long', timeZone: 'UTC' });
}

/** Lowercase letters, digits and underscores, 3–20 long. Same rule as the server. */
export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

/** How a player is named in lists and headers: their username, bare (no "@"). */
export function displayName(u: { username: string | null; displayName: string | null }) {
  return u.username ?? u.displayName ?? 'Player';
}

/** "November", with the year when it isn't this year: "March 2025". */
function sinceMonth(iso: string) {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, sameYear ? { month: 'long' } : { month: 'long', year: 'numeric' });
}

/** "Hunting since November", with the year when it isn't this year: "Hunting since March 2025". */
export function joinedLabel(iso: string) {
  return `Hunting since ${sinceMonth(iso)}`;
}

/** "Friends since November", with the year when it isn't this year. */
export function friendsSinceLabel(iso: string) {
  return `Friends since ${sinceMonth(iso)}`;
}

export function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : 'Something went wrong. Please try again.';
}
