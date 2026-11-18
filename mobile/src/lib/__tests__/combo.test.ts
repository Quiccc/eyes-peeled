import type { DailyWord, Difficulty } from '@/api/types';

import * as server from '../../../../server/src/services/scoring';
import { COMBO_BONUS, comboForLinks, comboPointsOf, linksAmong, trailLinks } from '../combo';

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'expert'];

/** A trail word; `foundAt` (minutes past midnight) marks it found. */
function word(i: number, foundAt?: number, comboPoints = 0): DailyWord {
  const createdAt = foundAt === undefined ? null : new Date(Date.UTC(2026, 10, 14, 0, foundAt)).toISOString();
  return {
    id: `w${i}`,
    difficulty: DIFFICULTIES[i],
    status: createdAt ? 'found' : 'open',
    submission: createdAt ? { createdAt, comboPoints } : null,
  } as unknown as DailyWord;
}

describe('combo rules match the server', () => {
  it('uses the same bonus table', () => {
    expect([...COMBO_BONUS]).toEqual([...server.COMBO_BONUS]);
  });

  it('agrees on links and totals for every set of found positions', () => {
    for (let mask = 0; mask < 16; mask++) {
      const found = [0, 1, 2, 3].filter((i) => mask & (1 << i));
      expect(linksAmong(found)).toBe(server.linksAmong(found));
      expect(comboForLinks(linksAmong(found))).toBe(server.comboForLinks(server.linksAmong(found)));
    }
  });
});

describe('combo', () => {
  it('totals 0, 50, 150, 350 for 0-3 links', () => {
    expect([0, 1, 2, 3].map(comboForLinks)).toEqual([0, 50, 150, 350]);
  });

  it('counts adjacent pairs only, in any order, ignoring repeats', () => {
    expect(linksAmong([])).toBe(0);
    expect(linksAmong([0, 2])).toBe(0);
    expect(linksAmong([1, 0])).toBe(1);
    expect(linksAmong([3, 0, 2, 1, 1])).toBe(3);
  });

  it('labels each trail link with what it paid, in the order links were made', () => {
    // A link lights when its second word is found: medium–hard at 0:10, hard–expert at 0:30, easy–medium at 0:40.
    const words = [word(0, 40), word(1, 5), word(2, 10), word(3, 30)];
    expect(trailLinks(words)).toEqual({ paid: [200, 50, 100], next: null });
    // Only easy–medium lit; expert alone makes no link.
    expect(trailLinks([word(0, 20), word(1, 5), word(2), word(3, 1)])).toEqual({ paid: [50, null, null], next: 100 });
  });

  it('shows nothing paid and the first bonus next on an empty trail', () => {
    expect(trailLinks([word(0), word(1), word(2)])).toEqual({ paid: [null, null], next: 50 });
    expect(trailLinks([word(0, 1), word(1, 2), word(2, 3), word(3, 4)]).next).toBeNull();
  });

  it('sums the combo points of found words', () => {
    expect(comboPointsOf([word(0, 1, 0), word(1, 2, 50), word(2), word(3, 9, 100)])).toBe(150);
  });
});
