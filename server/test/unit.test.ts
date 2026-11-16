import { describe, expect, it } from 'vitest';

import { byDifficulty } from '../src/domain/enums';
import { addDays, daysBetween } from '../src/lib/time';
import { isUuid } from '../src/lib/validation';
import { compareVersions } from '../src/middleware/app-version';
import { streakFrom } from '../src/services/profile';
import { comboCredits, comboForLinks, linksAmong, MAX_POINTS, pointsFor } from '../src/services/scoring';

describe('pointsFor', () => {
  it('gives full points at midnight UTC, falling to 20% by the end of the day', () => {
    expect(pointsFor('hard', new Date('2026-11-15T00:00:00Z'))).toBe(MAX_POINTS.hard);
    expect(pointsFor('hard', new Date('2026-11-15T12:00:00Z'))).toBe(MAX_POINTS.hard / 2);
    expect(pointsFor('hard', new Date('2026-11-15T23:59:59Z'))).toBe(MAX_POINTS.hard * 0.2);
  });

  it('pays more for harder words at the same time', () => {
    const at = new Date('2026-11-15T06:00:00Z');
    expect(pointsFor('easy', at)).toBeLessThan(pointsFor('medium', at));
    expect(pointsFor('hard', at)).toBeLessThan(pointsFor('expert', at));
  });
});

describe('combos', () => {
  it('counts links between adjacent found nodes', () => {
    expect(linksAmong([])).toBe(0);
    expect(linksAmong([0, 2])).toBe(0);
    expect(linksAmong([1, 0])).toBe(1);
    expect(linksAmong([3, 1, 2, 0])).toBe(3);
  });

  it('escalates per link', () => {
    expect([0, 1, 2, 3].map(comboForLinks)).toEqual([0, 50, 150, 350]);
  });

  it('credits each find with the bonus it added', () => {
    const credits = comboCredits([
      { id: 'hard', position: 2 },
      { id: 'easy', position: 0 },
      { id: 'medium', position: 1 }, // closes both links at once
      { id: 'expert', position: 3 },
    ]);
    expect([...credits]).toEqual([
      ['hard', 0],
      ['easy', 0],
      ['medium', 150],
      ['expert', 200],
    ]);
  });
});

describe('streakFrom', () => {
  it('counts consecutive days ending today', () => {
    expect(streakFrom(['2026-11-15', '2026-11-14', '2026-11-13', '2026-11-10'], '2026-11-15')).toBe(3);
  });

  it("still counts yesterday's streak before today's first find", () => {
    expect(streakFrom(['2026-11-14', '2026-11-13'], '2026-11-15')).toBe(2);
  });

  it('is zero after a missed day', () => {
    expect(streakFrom(['2026-11-13'], '2026-11-15')).toBe(0);
  });
});

describe('compareVersions', () => {
  it('compares numerically, part by part', () => {
    expect(compareVersions('1.10.0', '1.9.0')).toBe(1);
    expect(compareVersions('1.2.0', '1.2.0')).toBe(0);
    expect(compareVersions('1.2', '1.2.1')).toBe(-1);
  });
});

describe('dates', () => {
  it('adds and measures whole UTC days across month ends', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(daysBetween('2026-11-25', '2026-12-05')).toBe(10);
    expect(daysBetween('2026-12-05', '2026-11-25')).toBe(-10);
  });
});

describe('helpers', () => {
  it('sorts easy → expert', () => {
    const sorted = (['expert', 'easy', 'hard', 'medium'] as const).map((difficulty) => ({ difficulty })).sort(byDifficulty);
    expect(sorted.map((w) => w.difficulty)).toEqual(['easy', 'medium', 'hard', 'expert']);
  });

  it('recognizes id-shaped strings', () => {
    expect(isUuid('0b5e7c3e-2f1d-4a63-9c2e-6d1f1e9a7b10')).toBe(true);
    expect(isUuid('../etc/passwd')).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });
});
