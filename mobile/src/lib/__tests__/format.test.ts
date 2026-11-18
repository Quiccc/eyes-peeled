import {
  daysUntil,
  displayName,
  errorMessage,
  formatCountdown,
  ordinal,
  plural,
  timeAgo,
  USERNAME_RE,
} from '../format';

describe('format', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-14T12:00:00Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('formats countdowns as hh:mm:ss and never goes negative', () => {
    expect(formatCountdown(3725_000)).toBe('01:02:05');
    expect(formatCountdown(999)).toBe('00:00:00');
    expect(formatCountdown(-5000)).toBe('00:00:00');
  });

  it('says how long ago something happened', () => {
    expect(timeAgo('2026-11-14T11:59:30Z')).toBe('just now');
    expect(timeAgo('2026-11-14T11:15:00Z')).toBe('45m ago');
    expect(timeAgo('2026-11-14T07:00:00Z')).toBe('5h ago');
    expect(timeAgo('2026-11-11T12:00:00Z')).toBe('3d ago');
    // Clock skew: a time slightly in the future is still "just now".
    expect(timeAgo('2026-11-14T12:00:10Z')).toBe('just now');
  });

  it('counts whole days left, rounding up', () => {
    expect(daysUntil('2026-11-15T00:00:00Z')).toBe(1);
    expect(daysUntil('2026-11-16T13:00:00Z')).toBe(3);
    expect(daysUntil('2026-11-01T00:00:00Z')).toBe(0);
  });

  it('writes ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(ordinal)).toEqual([
      '1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st', '111th',
    ]);
  });

  it('pluralizes', () => {
    expect(plural(1, 'day')).toBe('1 day');
    expect(plural(0, 'day')).toBe('0 days');
    expect(plural(2, 'person', 'people')).toBe('2 people');
  });

  it('names players by username, then display name', () => {
    expect(displayName({ username: 'alex', displayName: 'Alex B' })).toBe('alex');
    expect(displayName({ username: null, displayName: 'Alex B' })).toBe('Alex B');
    expect(displayName({ username: null, displayName: null })).toBe('Player');
  });

  it('uses the server username rule', () => {
    for (const ok of ['abc', 'a_1', 'x'.repeat(20)]) expect(USERNAME_RE.test(ok)).toBe(true);
    for (const bad of ['ab', 'ABC', 'a-b', 'x'.repeat(21), 'a b']) expect(USERNAME_RE.test(bad)).toBe(false);
  });

  it('shows error messages, with a fallback', () => {
    expect(errorMessage(new Error('Nope'))).toBe('Nope');
    expect(errorMessage('weird')).toBe('Something went wrong. Please try again.');
  });
});
