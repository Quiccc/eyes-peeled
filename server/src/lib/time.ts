import type { Clock } from './clock';

export const DAY_MS = 86_400_000;

/** YYYY-MM-DD of the UTC day containing `at`. */
export const utcDate = (at: Date) => at.toISOString().slice(0, 10);

/** Today's UTC date by the context clock (tests move it). */
export const todayUtc = (clock: Clock) => utcDate(clock.now());

export const dayStartUtc = (at: Date) => new Date(Math.floor(at.getTime() / DAY_MS) * DAY_MS);

export const nextDayStartUtc = (at: Date) => new Date(dayStartUtc(at).getTime() + DAY_MS);

export const monthStartUtc = (at: Date) => new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));

export const nextMonthStartUtc = (at: Date) => new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1));

/** YYYY-MM */
export const utcMonth = (at: Date) => at.toISOString().slice(0, 7);

const parseDate = (isoDate: string) => Date.parse(`${isoDate}T00:00:00Z`);

export const addDays = (isoDate: string, days: number) => utcDate(new Date(parseDate(isoDate) + days * DAY_MS));

/** Whole days from `a` to `b` (negative when `b` is earlier). */
export const daysBetween = (a: string, b: string) => Math.round((parseDate(b) - parseDate(a)) / DAY_MS);
