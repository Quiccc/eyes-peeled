import { eq } from 'drizzle-orm';

import type { Ctx } from '../context';
import { users, type UserRow } from '../db/schema';
import { HttpError } from '../lib/errors';
import { logger } from '../lib/logger';
import { isUuid } from '../lib/validation';

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

async function setPremium(ctx: Ctx, userId: string, isPremium: boolean): Promise<UserRow | null> {
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
    logger.warn({ err: e, userId }, 'RevenueCat delete failed');
  }
}

const GRANT = new Set(['INITIAL_PURCHASE', 'NON_RENEWING_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE']);

/** RevenueCat's cancel_reason for a refund. Other reasons (e.g. UNSUBSCRIBE) leave access in place. */
const REFUND = 'CUSTOMER_SUPPORT';

export type WebhookEvent = {
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  entitlement_ids?: string[] | null;
  transferred_from?: string[];
  transferred_to?: string[];
  cancel_reason?: string;
};

/**
 * Set isPremium from what RevenueCat says the user owns now. Without a secret key (dev) there is
 * nothing to ask, so `assumed` (what the event implies) is used. A RevenueCat outage throws, so the
 * webhook answers 5xx and RevenueCat retries it.
 */
async function applyEntitlement(ctx: Ctx, userId: string, assumed: boolean): Promise<void> {
  const owns = ctx.env.REVENUECAT_SECRET_KEY ? await hasPremium(ctx, userId) : assumed;
  await setPremium(ctx, userId, owns);
}

/** RevenueCat webhook. Keeps isPremium right without the app (refunds, transfers). */
export async function handleWebhook(ctx: Ctx, event: WebhookEvent): Promise<void> {
  const type = event.type ?? '';

  if (type === 'TRANSFER') {
    // The event alone doesn't say the transferred purchase includes Premium, so ask.
    for (const id of event.transferred_from ?? []) if (isUuid(id)) await applyEntitlement(ctx, id, false);
    for (const id of event.transferred_to ?? []) if (isUuid(id)) await applyEntitlement(ctx, id, true);
    return;
  }
  const userId = isUuid(event.app_user_id) ? event.app_user_id : event.original_app_user_id;
  if (!isUuid(userId)) return; // anonymous RevenueCat ids are not ours
  if (event.entitlement_ids && !event.entitlement_ids.includes(ENTITLEMENT)) return;

  if (GRANT.has(type)) await setPremium(ctx, userId, true);
  // A lifetime purchase is only lost through a refund. Even then the user may own Premium through
  // another purchase, so ask RevenueCat rather than revoking outright.
  else if (type === 'CANCELLATION' && event.cancel_reason === REFUND) await applyEntitlement(ctx, userId, false);
  else if (type === 'EXPIRATION') await applyEntitlement(ctx, userId, false);
}
