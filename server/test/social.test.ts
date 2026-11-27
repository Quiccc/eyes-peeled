import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { BlockedUser, Daily, FriendsList, Leaderboard, UserProfile } from '@shared/types';

import { jpeg, startTestServer, type TestServer } from './helpers';

let t: TestServer;
beforeEach(async () => {
  t = await startTestServer();
});
afterEach(() => t.close());

type Player = Awaited<ReturnType<TestServer['signIn']>>;

async function find(p: Player, index = 0) {
  const words = ((await t.http().get('/daily').set(p.auth)).body as Daily).words;
  const res = await t.http().post(`/words/${words[index]!.id}/submissions`).set(p.auth).attach('photo', jpeg(), 'p.jpg');
  expect(res.body.status).toBe('valid');
  return res.body;
}

async function befriend(a: Player, b: Player) {
  await t.http().post('/friends/requests').set(a.auth).send({ userId: b.id });
  // Requesting back accepts the pending request.
  await t.http().post('/friends/requests').set(b.auth).send({ userId: a.id });
}

const board = async (p: Player, scope: 'global' | 'friends') =>
  (await t.http().get('/leaderboard').query({ scope }).set(p.auth)).body as Leaderboard;

describe('friends', () => {
  it('sends, lists, accepts and removes requests', async () => {
    const a = await t.signIn('alex');
    const b = await t.signIn('bob');
    expect((await t.http().post('/friends/requests').set(a.auth).send({ userId: b.id })).status).toBe(204);

    const search = await t.http().get('/users/search').query({ q: 'bo' }).set(a.auth);
    expect(search.body).toEqual([expect.objectContaining({ friendStatus: 'outgoing' })]);

    const incoming = await t.http().get('/friends/requests').set(b.auth);
    expect(incoming.body).toHaveLength(1);
    expect(incoming.body[0].from.username).toBe('alex');

    const accept = await t.http().post(`/friends/requests/${incoming.body[0].id}/accept`).set(b.auth);
    expect(accept.status).toBe(204);
    const profile = (await t.http().get(`/users/${b.id}`).set(a.auth)).body as UserProfile;
    expect(profile.friendStatus).toBe('friends');

    await t.http().delete(`/friends/${b.id}`).set(a.auth);
    expect(((await t.http().get(`/users/${b.id}`).set(a.auth)).body as UserProfile).friendStatus).toBe('none');
  });

  it('declines a request without becoming friends', async () => {
    const a = await t.signIn('alex');
    const b = await t.signIn('bob');
    await t.http().post('/friends/requests').set(a.auth).send({ userId: b.id });
    const [request] = (await t.http().get('/friends/requests').set(b.auth)).body;

    expect((await t.http().post(`/friends/requests/${request.id}/decline`).set(b.auth)).status).toBe(204);
    expect((await t.http().get('/friends/requests').set(b.auth)).body).toEqual([]);
    expect(((await t.http().get(`/users/${a.id}`).set(b.auth)).body as UserProfile).friendStatus).toBe('none');
  });

  it('accepting a request that is not yours is a 404', async () => {
    const a = await t.signIn('alex');
    const b = await t.signIn('bob');
    const c = await t.signIn('cara');
    await t.http().post('/friends/requests').set(a.auth).send({ userId: b.id });
    const [request] = (await t.http().get('/friends/requests').set(b.auth)).body;
    expect((await t.http().post(`/friends/requests/${request.id}/accept`).set(c.auth)).status).toBe(404);
    expect((await t.http().post('/friends/requests/not-an-id/accept').set(c.auth)).status).toBe(404);
  });

  it('asking someone who already asked you makes you friends', async () => {
    const a = await t.signIn('alex');
    const b = await t.signIn('bob');
    await befriend(a, b);
    expect((await t.http().get('/friends/requests').set(b.auth)).body).toEqual([]);
    expect(((await t.http().get(`/users/${b.id}`).set(a.auth)).body as UserProfile).friendStatus).toBe('friends');
  });

  it('search shows each relationship', async () => {
    const a = await t.signIn('alex');
    const b = await t.signIn('bob');
    const c = await t.signIn('bea');
    await befriend(a, b);
    await t.http().post('/friends/requests').set(c.auth).send({ userId: a.id });
    const results = (await t.http().get('/users/search').query({ q: 'b' }).set(a.auth)).body as {
      user: { username: string };
      friendStatus: string;
    }[];
    expect(Object.fromEntries(results.map((r) => [r.user.username, r.friendStatus]))).toEqual({
      bea: 'incoming',
      bob: 'friends',
    });
  });

  it("shows friends' finds in the feed and profile, but not strangers'", async () => {
    const a = await t.signIn('alex');
    const b = await t.signIn('bob');
    const c = await t.signIn('cara');
    await befriend(a, b);
    await find(b);
    await find(c);

    const feed = await t.http().get('/feed/today').set(a.auth);
    expect(feed.body.map((f: { user: { username: string } }) => f.user.username)).toEqual(['bob']);

    expect(((await t.http().get(`/users/${b.id}`).set(a.auth)).body as UserProfile).today).toHaveLength(1);
    expect(((await t.http().get(`/users/${c.id}`).set(a.auth)).body as UserProfile).today).toHaveLength(0);
  });

  it('blocking removes the friendship and hides the user', async () => {
    const a = await t.signIn('alex');
    const b = await t.signIn('bob');
    await befriend(a, b);
    await find(a);
    await find(b);

    expect((await t.http().post('/blocks').set(a.auth).send({ userId: b.id })).status).toBe(204);
    expect((await t.http().get('/feed/today').set(a.auth)).body).toEqual([]);
    expect((await t.http().get('/users/search').query({ q: 'bob' }).set(a.auth)).body).toEqual([]);
    expect((await t.http().get('/users/search').query({ q: 'alex' }).set(b.auth)).body).toEqual([]);
    expect((await t.http().get(`/users/${a.id}`).set(b.auth)).status).toBe(404);
    expect((await board(a, 'global')).entries.map((e) => e.user.username)).toEqual(['alex']);
  });

  it('lists friends A–Z and pending sent requests', async () => {
    const a = await t.signIn('alex');
    const b = await t.signIn('zed');
    const c = await t.signIn('bea');
    const d = await t.signIn('dana');
    await befriend(a, b);
    await befriend(a, c);
    await t.http().post('/friends/requests').set(a.auth).send({ userId: d.id });

    const list = async () => (await t.http().get('/friends').set(a.auth)).body as FriendsList;
    const names = (l: FriendsList) => ({
      friends: l.friends.map((f) => f.user.username),
      sent: l.sent.map((s) => s.to.username),
    });
    const first = await list();
    expect(names(first)).toEqual({ friends: ['bea', 'zed'], sent: ['dana'] });
    expect(first.friends[0]!.since).toEqual(expect.any(String));
    // The other side sees no sent requests, only the friendship.
    expect(names((await t.http().get('/friends').set(c.auth)).body)).toEqual({ friends: ['alex'], sent: [] });

    // Cancelling a request and removing a friend both drop them from the list; so does a block.
    await t.http().delete(`/friends/${d.id}`).set(a.auth);
    await t.http().delete(`/friends/${c.id}`).set(a.auth);
    await t.http().post('/blocks').set(b.auth).send({ userId: a.id });
    expect(names(await list())).toEqual({ friends: [], sent: [] });
  });

  it('friends list needs sign-in', async () => {
    expect((await t.http().get('/friends')).status).toBe(401);
  });

  it('friends list starts empty, and incoming requests are not "sent"', async () => {
    const a = await t.signIn('alex');
    const b = await t.signIn('bob');
    expect((await t.http().get('/friends').set(a.auth)).body).toEqual({ friends: [], sent: [] });
    await t.http().post('/friends/requests').set(b.auth).send({ userId: a.id });
    expect((await t.http().get('/friends').set(a.auth)).body).toEqual({ friends: [], sent: [] });
    const bobs = (await t.http().get('/friends').set(b.auth)).body as FriendsList;
    expect(bobs.sent).toEqual([
      { id: expect.any(String), to: expect.objectContaining({ id: a.id, username: 'alex' }), createdAt: expect.any(String) },
    ]);
  });

  it('a sent request moves to friends when accepted, and disappears when declined', async () => {
    const a = await t.signIn('alex');
    const b = await t.signIn('bob');
    const c = await t.signIn('cara');
    await t.http().post('/friends/requests').set(a.auth).send({ userId: b.id });
    await t.http().post('/friends/requests').set(a.auth).send({ userId: c.id });
    const sentIds = ((await t.http().get('/friends').set(a.auth)).body as FriendsList).sent.map((s) => s.to.username);
    expect(sentIds).toEqual(['cara', 'bob']); // newest first

    const [fromAlexToBob] = (await t.http().get('/friends/requests').set(b.auth)).body;
    const [fromAlexToCara] = (await t.http().get('/friends/requests').set(c.auth)).body;
    await t.http().post(`/friends/requests/${fromAlexToBob.id}/accept`).set(b.auth);
    await t.http().post(`/friends/requests/${fromAlexToCara.id}/decline`).set(c.auth);

    const list = (await t.http().get('/friends').set(a.auth)).body as FriendsList;
    expect(list.friends.map((f) => f.user.username)).toEqual(['bob']);
    expect(list.sent).toEqual([]);
    expect(Date.parse(list.friends[0]!.since)).not.toBeNaN();
  });

  it('a sent request is hidden once they block you, and a friend you block is gone', async () => {
    const a = await t.signIn('alex');
    const b = await t.signIn('bob');
    const c = await t.signIn('cara');
    await t.http().post('/friends/requests').set(a.auth).send({ userId: b.id });
    await befriend(a, c);
    await t.http().post('/blocks').set(b.auth).send({ userId: a.id });
    await t.http().post('/blocks').set(a.auth).send({ userId: c.id });
    expect((await t.http().get('/friends').set(a.auth)).body).toEqual({ friends: [], sent: [] });
    // Unblocking doesn't bring the friendship back.
    await t.http().delete(`/blocks/${c.id}`).set(a.auth);
    expect(((await t.http().get('/friends').set(a.auth)).body as FriendsList).friends).toEqual([]);
  });

  it('removing a friend from the list leaves the friends board with only you', async () => {
    const a = await t.signIn('alex');
    const b = await t.signIn('bob');
    await befriend(a, b);
    await find(b);
    expect((await board(a, 'friends')).entries.map((e) => e.user.username)).toEqual(['bob', 'alex']);
    await t.http().delete(`/friends/${b.id}`).set(a.auth);
    const after = await board(a, 'friends');
    expect(after.entries.map((e) => e.user.username)).toEqual(['alex']);
    expect(after.nextCursor).toBeNull();
  });

  it('lists blocked players and unblocks them', async () => {
    const a = await t.signIn('alex');
    const b = await t.signIn('bob');
    await t.http().post('/blocks').set(a.auth).send({ userId: b.id });

    const listed = await t.http().get('/blocks').set(a.auth);
    expect(listed.status).toBe(200);
    expect(listed.body.map((x: BlockedUser) => x.user.username)).toEqual(['bob']);
    expect((await t.http().get('/blocks').set(b.auth)).body).toEqual([]);
    const add = () => t.http().post('/friends/requests').set(a.auth).send({ userId: b.id });
    expect((await add()).body.message).toMatch(/Unblock/);

    // Only the blocker can lift a block.
    expect((await t.http().delete(`/blocks/${a.id}`).set(b.auth)).status).toBe(204);
    expect((await t.http().get(`/users/${a.id}`).set(b.auth)).status).toBe(404);

    expect((await t.http().delete(`/blocks/${b.id}`).set(a.auth)).status).toBe(204);
    expect((await t.http().get('/blocks').set(a.auth)).body).toEqual([]);
    expect((await t.http().get(`/users/${a.id}`).set(b.auth)).status).toBe(200);
    expect((await t.http().get('/users/search').query({ q: 'bob' }).set(a.auth)).body).toHaveLength(1);
    expect((await add()).status).toBe(204);

    // Unblocking someone who isn't blocked is fine; a malformed id isn't.
    expect((await t.http().delete(`/blocks/${b.id}`).set(a.auth)).status).toBe(204);
    expect((await t.http().delete('/blocks/nope').set(a.auth)).status).toBe(400);
  });
});

describe('leaderboard and profile', () => {
  it('ranks by points, breaking ties by who got there first', async () => {
    const a = await t.signIn('alex');
    const b = await t.signIn('bob');
    const c = await t.signIn('cara');
    // Same points (75) for both; bob got there 30 s earlier, so bob wins the tie.
    await find(b);
    t.setNow('2026-11-14T06:00:30Z');
    await find(a);
    t.setNow('2026-11-14T12:00:00Z');
    await find(c); // fewer points (later in the day)

    const g = await board(a, 'global');
    expect(g.month).toBe('2026-11');
    expect(g.resetsAt).toBe('2026-12-01T00:00:00.000Z');
    expect(g.entries.map((e) => [e.user.username, e.points, e.rank])).toEqual([
      ['bob', 75, 1],
      ['alex', 75, 2],
      ['cara', 50, 3],
    ]);
    expect(g.me).toMatchObject({ rank: 2, points: 75 });
  });

  it('friends scope always includes you, even at 0', async () => {
    const a = await t.signIn('alex');
    const b = await t.signIn('bob');
    await t.signIn('cara').then(find);
    await befriend(a, b);
    await find(b);

    const f = await board(a, 'friends');
    expect(f.entries.map((e) => [e.user.username, e.points])).toEqual([
      ['bob', 75],
      ['alex', 0],
    ]);
    expect(f.me).toMatchObject({ rank: 2, points: 0 });
    expect((await board(a, 'global')).me).toBeNull();
  });

  it('paginates with a cursor', async () => {
    const me = await t.signIn('zed');
    for (let i = 0; i < 22; i++) await find(await t.signIn(`player${i}`));
    const page1 = await board(me, 'global');
    expect(page1.entries).toHaveLength(20);
    expect(page1.nextCursor).toBe('20');
    const page2 = (await t.http().get('/leaderboard').query({ scope: 'global', cursor: '20' }).set(me.auth))
      .body as Leaderboard;
    expect(page2.entries.map((e) => e.rank)).toEqual([21, 22]);
    expect(page2.nextCursor).toBeNull();
  });

  it('counts streaks of consecutive UTC days', async () => {
    const a = await t.signIn('alex');
    for (const day of ['2026-11-11', '2026-11-12', '2026-11-13']) {
      t.setNow(`${day}T10:00:00Z`);
      await find(a);
    }
    t.setNow('2026-11-14T08:00:00Z');
    let p = (await t.http().get('/me/profile').set(a.auth)).body as UserProfile;
    expect(p).toMatchObject({ streak: 3, totalFinds: 3, monthRank: 1 }); // yesterday still counts
    await find(a);
    p = (await t.http().get('/me/profile').set(a.auth)).body as UserProfile;
    expect(p.streak).toBe(4);
    expect(p.today).toHaveLength(1);
    t.setNow('2026-11-16T08:00:00Z');
    p = (await t.http().get('/me/profile').set(a.auth)).body as UserProfile;
    expect(p.streak).toBe(0);
  });
});

describe('account and moderation', () => {
  it('deleting the account removes the user and their data', async () => {
    const a = await t.signIn('alex');
    const b = await t.signIn('bob');
    await befriend(a, b);
    await find(a);

    expect((await t.http().delete('/me').set(a.auth)).status).toBe(204);
    expect((await t.http().get('/me').set(a.auth)).status).toBe(401);
    expect((await board(b, 'global')).entries).toEqual([]);
    expect(((await t.http().get('/me/profile').set(b.auth)).body as UserProfile).friendStatus).toBe('friends');
    expect((await board(b, 'friends')).entries.map((e) => e.user.username)).toEqual(['bob']);

    // Signing in again starts fresh.
    const back = await t.http().post('/auth/signin').send({ provider: 'google', idToken: 'dev:alex' });
    expect(back.body.isNewUser).toBe(true);
  });

  it('admins can remove photos and ban users', async () => {
    const mod = await startTestServer({ ADMIN_TOKEN: 'admin-secret' });
    try {
      const a = await mod.signIn('alex');
      const b = await mod.signIn('bob');
      const words = ((await mod.http().get('/daily').set(a.auth)).body as Daily).words;
      const sub = (await mod.http().post(`/words/${words[0]!.id}/submissions`).set(a.auth).attach('photo', jpeg(), 'p.jpg'))
        .body;
      await mod.http().post('/reports').set(b.auth).send({ submissionId: sub.id, reason: 'cheating' });

      expect((await mod.http().get('/admin/reports')).status).toBe(404); // no token
      const admin = { Authorization: 'Bearer admin-secret' };
      const reports = await mod.http().get('/admin/reports').set(admin);
      expect(reports.body).toHaveLength(1);
      expect(reports.body[0].submission.id).toBe(sub.id);

      await mod.http().post(`/admin/submissions/${sub.id}/remove`).set(admin);
      const lb = (await mod.http().get('/leaderboard').set(b.auth)).body as Leaderboard;
      expect(lb.entries).toEqual([]);

      await mod.http().post(`/admin/users/${a.id}/ban`).set(admin);
      const banned = await mod.http().get('/me').set(a.auth);
      expect(banned.status).toBe(403);
      expect(banned.body.code).toBe('banned');
    } finally {
      await mod.close();
    }
  });

  it('applies RevenueCat webhooks', async () => {
    const hook = await startTestServer({ REVENUECAT_WEBHOOK_AUTH: 'Bearer hook' });
    try {
      const a = await hook.signIn('alex');
      const send = (type: string, auth = 'Bearer hook') =>
        hook.http().post('/webhooks/revenuecat').set('Authorization', auth).send({ event: { type, app_user_id: a.id } });
      const sendEvent = (event: object) =>
        hook.http().post('/webhooks/revenuecat').set('Authorization', 'Bearer hook').send({ event });
      expect((await send('INITIAL_PURCHASE', 'Bearer wrong')).status).toBe(401);
      await send('NON_RENEWING_PURCHASE');
      expect((await hook.http().get('/me').set(a.auth)).body.isPremium).toBe(true);
      // Only a refund takes a lifetime purchase away.
      await sendEvent({ type: 'CANCELLATION', cancel_reason: 'UNSUBSCRIBE', app_user_id: a.id });
      expect((await hook.http().get('/me').set(a.auth)).body.isPremium).toBe(true);
      await sendEvent({ type: 'CANCELLATION', cancel_reason: 'CUSTOMER_SUPPORT', app_user_id: a.id });
      expect((await hook.http().get('/me').set(a.auth)).body.isPremium).toBe(false);
      // Events for other entitlements are ignored.
      await sendEvent({ type: 'INITIAL_PURCHASE', entitlement_ids: ['other'], app_user_id: a.id });
      expect((await hook.http().get('/me').set(a.auth)).body.isPremium).toBe(false);

      // Restoring on a new account moves Premium from the old user to the new one.
      const b = await hook.signIn('blair');
      await send('NON_RENEWING_PURCHASE');
      await hook
        .http()
        .post('/webhooks/revenuecat')
        .set('Authorization', 'Bearer hook')
        .send({ event: { type: 'TRANSFER', transferred_from: [a.id], transferred_to: [b.id] } });
      expect((await hook.http().get('/me').set(a.auth)).body.isPremium).toBe(false);
      expect((await hook.http().get('/me').set(b.auth)).body.isPremium).toBe(true);
    } finally {
      await hook.close();
    }
  });

  it('asks RevenueCat who owns Premium on refunds and transfers', async () => {
    const hook = await startTestServer({ REVENUECAT_WEBHOOK_AUTH: 'Bearer hook', REVENUECAT_SECRET_KEY: 'sk_test' });
    const owners = new Set<string>();
    let storeDown = false;
    vi.stubGlobal('fetch', async (url: string) => {
      if (storeDown) return new Response('down', { status: 503 });
      const id = decodeURIComponent(url.split('/subscribers/')[1]!);
      const entitlements = owners.has(id) ? { premium: { expires_date: null } } : {};
      return Response.json({ subscriber: { entitlements } });
    });
    try {
      const a = await hook.signIn('alex');
      const b = await hook.signIn('blair');
      const send = (event: object) =>
        hook.http().post('/webhooks/revenuecat').set('Authorization', 'Bearer hook').send({ event });
      const premium = async (auth: Record<string, string>) => (await hook.http().get('/me').set(auth)).body.isPremium;

      // A transfer of a purchase that doesn't include Premium grants nothing.
      await send({ type: 'TRANSFER', transferred_from: [a.id], transferred_to: [b.id] });
      expect(await premium(b.auth)).toBe(false);

      // A refund of one purchase keeps Premium the user still owns another way.
      owners.add(a.id);
      await send({ type: 'NON_RENEWING_PURCHASE', app_user_id: a.id });
      await send({ type: 'CANCELLATION', cancel_reason: 'CUSTOMER_SUPPORT', app_user_id: a.id });
      expect(await premium(a.auth)).toBe(true);

      // A real transfer moves it.
      owners.delete(a.id);
      owners.add(b.id);
      await send({ type: 'TRANSFER', transferred_from: [a.id], transferred_to: [b.id] });
      expect(await premium(a.auth)).toBe(false);
      expect(await premium(b.auth)).toBe(true);

      // RevenueCat unreachable: answer an error so the webhook is retried.
      storeDown = true;
      expect((await send({ type: 'EXPIRATION', app_user_id: b.id })).status).toBe(502);
      expect(await premium(b.auth)).toBe(true);
    } finally {
      vi.unstubAllGlobals();
      await hook.close();
    }
  });
});
