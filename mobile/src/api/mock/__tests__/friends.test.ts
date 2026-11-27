import { mockApi } from '@/api/mock';
import { state } from '@/api/mock/state';
import { friendsSinceLabel } from '@/lib/format';
import { isAlone } from '@/lib/leaderboard';

jest.setTimeout(30_000);

const names = (l: Awaited<ReturnType<typeof mockApi.getFriends>>) => ({
  friends: l.friends.map((f) => f.user.username),
  sent: l.sent.map((s) => s.to.username),
});

describe('mock friends list (what the Friends side shows in mock mode)', () => {
  beforeAll(async () => {
    await mockApi.signIn({ provider: 'google', idToken: 'x' } as never);
  });

  it('starts with the three fixture friends, A–Z, and nothing sent', async () => {
    const list = await mockApi.getFriends();
    expect(names(list)).toEqual({ friends: ['alex', 'jordan', 'sam'], sent: [] });
    expect(list.friends.every((f) => !Number.isNaN(Date.parse(f.since)))).toBe(true);
  });

  it('sending a request shows it under Sent, and cancelling removes it', async () => {
    await mockApi.sendFriendRequest('u4');
    expect(names(await mockApi.getFriends()).sent).toEqual(['taylor']);
    await mockApi.removeFriend('u4');
    expect(names(await mockApi.getFriends()).sent).toEqual([]);
  });

  it('accepting the incoming request adds a friend', async () => {
    const [req] = await mockApi.getFriendRequests();
    await mockApi.respondFriendRequest(req!.id, 'accept');
    expect(await mockApi.getFriendRequests()).toEqual([]);
    expect(names(await mockApi.getFriends()).friends).toContain(req!.from.username);
  });

  it('removing and blocking friends empties the list, and the friends board is then just you', async () => {
    const before = await mockApi.getLeaderboard({ scope: 'friends' });
    const me = state.me!.id;
    expect(isAlone(before.entries, me, !!before.nextCursor)).toBe(false);

    const { friends } = await mockApi.getFriends();
    const [first, ...rest] = friends;
    await mockApi.blockUser(first!.user.id);
    for (const f of rest) await mockApi.removeFriend(f.user.id);
    expect(names(await mockApi.getFriends())).toEqual({ friends: [], sent: [] });

    const after = await mockApi.getLeaderboard({ scope: 'friends' });
    expect(after.entries.map((e) => e.user.id)).toEqual([me]);
    expect(isAlone(after.entries, me, !!after.nextCursor)).toBe(true);
  });
});

describe('friendsSinceLabel', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-14T12:00:00Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('names the month, adding the year only when it differs', () => {
    expect(friendsSinceLabel('2026-09-03T10:00:00Z')).toMatch(/^Friends since September$/);
    expect(friendsSinceLabel('2025-03-03T10:00:00Z')).toMatch(/^Friends since March 2025$/);
  });
});
