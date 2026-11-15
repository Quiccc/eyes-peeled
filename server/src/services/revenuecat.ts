import { eq } from 'drizzle-orm';

import type { Ctx } from '../context';
import { users, type UserRow } from '../db/schema';
import { HttpError } from '../lib/errors';

const API = 'https://api.revenuecat.com/v1';
const ENTITLEMENT = 'premium';

type Subscriber = {
  subscriber?: { entitlements?: Record<string, { expires_date: string | null } | undefined> };
};

/** Ask RevenueCat whether the user owns Premium. */
async function hasPremium(ctx: Ctx, userId: string): Promise<boolean> {
  const res = await fetch(`${API}/subscribers/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${ctx.env.REVENUECAT_SECRET_KEY}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new HttpError(502, 'server_error', "We couldn't reach the store. Please try again.");
  const body = (await res.json()) as Subscriber;
  const ent = body.subscriber?.entitlements?.[ENTITLEMENT];
  if (!ent) return false;
  // Lifetime purchases have expires_date null.
  return ent.expires_date === null || new Date(ent.expires_date) > ctx.clock.now();
}

export async function setPremium(ctx: Ctx, userId: string, isPremium: boolean): Promise<UserRow | null> {
  const [row] = await ctx.db.update(users).set({ isPremium }).where(eq(users.id, userId)).returning();
  return row ?? null;
}

/** POST /me/purchases/sync. In dev without a secret key, grants Premium (like the app's mock). */
export async function syncPremium(ctx: Ctx, user: UserRow): Promise<UserRow> {
  const owns = ctx.env.REVENUECAT_SECRET_KEY ? await hasPremium(ctx, user.id) : ctx.env.NODE_ENV !== 'production';
  return (await setPremium(ctx, user.id, owns)) ?? user;
}

/** Account deletion: remove the RevenueCat customer. Best effort. */
export async function deleteCustomer(ctx: Ctx, userId: string): Promise<void> {
  if (!ctx.env.REVENUECAT_SECRET_KEY) return;
  try {
    await fetch(`${API}/subscribers/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${ctx.env.REVENUECAT_SECRET_KEY}` },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    console.warn('RevenueCat delete failed', e);
  }
}

const GRANT = new Set(['INITIAL_PURCHASE', 'NON_RENEWING_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE']);
const REVOKE = new Set(['CANCELLATION', 'EXPIRATION']);

type WebhookEvent = {
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  entitlement_ids?: string[] | null;
  transferred_from?: string[];
  transferred_to?: string[];
  cancel_reason?: string;
};

/** RevenueCat webhook. Keeps isPremium right without the app (refunds, transfers). */
export async function handleWebhook(ctx: Ctx, event: WebhookEvent): Promise<void> {
  const isUuid = (id: string | undefined): id is string => !!id && /^[0-9a-f-]{36}$/i.test(id);
  const type = event.type ?? '';

  if (type === 'TRANSFER') {
    for (const id of event.transferred_from ?? []) if (isUuid(id)) await setPremium(ctx, id, false);
    for (const id of event.transferred_to ?? []) if (isUuid(id)) await setPremium(ctx, id, true);
    return;
  }
  const userId = isUuid(event.app_user_id) ? event.app_user_id : event.original_app_user_id;
  if (!isUuid(userId)) return; // anonymous RevenueCat ids are not ours
  if (event.entitlement_ids && !event.entitlement_ids.includes(ENTITLEMENT)) return;

  // A lifetime purchase is only lost through a refund (CANCELLATION with reason CUSTOMER_SUPPORT / refund).
  if (GRANT.has(type)) await setPremium(ctx, userId, true);
  else if (REVOKE.has(type)) await setPremium(ctx, userId, false);
}
