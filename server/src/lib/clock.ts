/** Injectable clock so tests can move time. */
export type Clock = { now(): Date };

export const systemClock: Clock = { now: () => new Date() };
