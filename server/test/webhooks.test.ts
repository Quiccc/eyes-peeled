import { afterEach, describe, expect, it, vi } from 'vitest';

import { startTestServer, type TestServer } from './helpers';

let t: TestServer;
afterEach(async () => {
  vi.unstubAllGlobals();
  await t.close();
});

const HOOK = 'Bearer hook';
const send = (body: object, auth = HOOK) =>
  t.http().post('/webhooks/revenuecat').set('Authorization', auth).send(body);
const premium = async (auth: Record<string, string>) => (await t.http().get('/me').set(auth)).body.isPremium as boolean;

describe('RevenueCat webhook edge cases', () => {
  it('is closed when no webhook secret is configured', async () => {
    t = await startTestServer();
    const res = await send({ event: { type: 'INITIAL_PURCHASE' } }, '');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('unauthorized');
  });

  it('ignores empty, unknown and anonymous events', async () => {
    t = await startTestServer({ REVENUECAT_WEBHOOK_AUTH: HOOK });
    const a = await t.signIn('alex');
    expect((await send({})).body).toEqual({ ok: true });
    expect((await send({ event: { type: 'SOMETHING_NEW', app_user_id: a.id } })).status).toBe(200);
    expect((await send({ event: { type: 'INITIAL_PURCHASE', app_user_id: '$RCAnonymousID:abc' } })).status).toBe(200);
    expect(await premium(a.auth)).toBe(false);
  });

  it('falls back to original_app_user_id when app_user_id is anonymous', async () => {
    t = await startTestServer({ REVENUECAT_WEBHOOK_AUTH: HOOK });
    const a = await t.signIn('alex');
    await send({ event: { type: 'INITIAL_PURCHASE', app_user_id: '$RCAnonymousID:x', original_app_user_id: a.id } });
    expect(await premium(a.auth)).toBe(true);
  });

  it('grants on every purchase-like event, and treats a null entitlement list as "all"', async () => {
    t = await startTestServer({ REVENUECAT_WEBHOOK_AUTH: HOOK });
    for (const type of ['RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE']) {
      const u = await t.signIn(type.toLowerCase().slice(0, 12));
      await send({ event: { type, app_user_id: u.id, entitlement_ids: null } });
      expect(await premium(u.auth)).toBe(true);
    }
    const b = await t.signIn('blair');
    await send({ event: { type: 'INITIAL_PURCHASE', app_user_id: b.id, entitlement_ids: ['premium', 'other'] } });
    expect(await premium(b.auth)).toBe(true);
  });

  it("checks an EXPIRATION against the store's expiry date", async () => {
    t = await startTestServer({ REVENUECAT_WEBHOOK_AUTH: HOOK, REVENUECAT_SECRET_KEY: 'sk_test' });
    let expires: string | null = '2026-11-01T00:00:00Z'; // before the test clock (2026-11-14)
    vi.stubGlobal('fetch', async () => Response.json({ subscriber: { entitlements: { premium: { expires_date: expires } } } }));
    const a = await t.signIn('alex');
    await send({ event: { type: 'INITIAL_PURCHASE', app_user_id: a.id } });
    await send({ event: { type: 'EXPIRATION', app_user_id: a.id } });
    expect(await premium(a.auth)).toBe(false);

    expires = '2027-01-01T00:00:00Z';
    await send({ event: { type: 'INITIAL_PURCHASE', app_user_id: a.id } });
    await send({ event: { type: 'EXPIRATION', app_user_id: a.id } });
    expect(await premium(a.auth)).toBe(true);
  });

  it('answers 502 on any store error so RevenueCat retries', async () => {
    t = await startTestServer({ REVENUECAT_WEBHOOK_AUTH: HOOK, REVENUECAT_SECRET_KEY: 'sk_test' });
    vi.stubGlobal('fetch', async () => new Response('boom', { status: 500 }));
    const a = await t.signIn('alex');
    const res = await send({ event: { type: 'EXPIRATION', app_user_id: a.id } });
    expect(res.status).toBe(502);
  });

  it('skips non-UUID ids in transfers', async () => {
    t = await startTestServer({ REVENUECAT_WEBHOOK_AUTH: HOOK });
    const a = await t.signIn('alex');
    const res = await send({ event: { type: 'TRANSFER', transferred_from: ['$RCAnonymousID:x'], transferred_to: [a.id, 'junk'] } });
    expect(res.status).toBe(200);
    expect(await premium(a.auth)).toBe(true);
  });
});
