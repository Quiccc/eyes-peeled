import { Platform } from 'react-native';
import Purchases, { PURCHASES_ERROR_CODE, type PurchasesError, type PurchasesPackage } from 'react-native-purchases';

import { api, USE_MOCK_API } from '@/api/endpoints';
import type { User } from '@/api/types';

/**
 * One-time "Premium" purchase (no ads + the daily Premium word), sold through RevenueCat.
 *
 * RevenueCat setup: entitlement `premium` ← lifetime product (App Store non-consumable /
 * Play one-time product), in the `current` offering. The RevenueCat app user id is our
 * backend user id, so the server can verify the entitlement and owns `User.isPremium`.
 * The app never decides premium on its own — after a purchase/restore it calls
 * `api.syncPurchases()` and uses the user the server returns.
 */

const API_KEY = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
});

/** Mock backend + no RevenueCat key: skip the store so the demo works without App Store / Play setup. */
const SIMULATED = USE_MOCK_API && !API_KEY;

let configured = false;

/** Configure RevenueCat and identify the signed-in user. Safe to call repeatedly; never throws. */
export async function initPurchases(userId: string): Promise<void> {
  if (SIMULATED || !API_KEY) return;
  try {
    if (!configured) {
      Purchases.configure({ apiKey: API_KEY, appUserID: userId });
      configured = true;
    } else {
      await Purchases.logIn(userId);
    }
  } catch (e) {
    console.warn('Purchases init failed', e);
  }
}

/** Forget the RevenueCat user on sign-out / account deletion. Never throws. */
export async function resetPurchases(): Promise<void> {
  if (!configured) return;
  try {
    // logOut() throws when the current user is already anonymous.
    if (!(await Purchases.isAnonymous())) await Purchases.logOut();
  } catch (e) {
    console.warn('Purchases reset failed', e);
  }
}

export type PremiumOffer = { priceString: string | null; pkg: PurchasesPackage | null };

/** The lifetime package from the current offering, for showing the localized price. */
export async function getPremiumOffer(): Promise<PremiumOffer> {
  if (SIMULATED) return { priceString: null, pkg: null };
  if (!configured) throw new Error('Purchases are not available right now. Please try again later.');
  const offerings = await Purchases.getOfferings();
  const pkg = offerings.current?.lifetime ?? offerings.current?.availablePackages[0] ?? null;
  if (!pkg) throw new Error('Premium is not available right now. Please try again later.');
  return { priceString: pkg.product.priceString, pkg };
}

function isCancel(e: unknown) {
  const err = e as Partial<PurchasesError> & { userCancelled?: boolean | null };
  return err?.userCancelled === true || err?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR;
}

/** Buy Premium. Resolves with the updated user, or 'cancelled' if the user backed out of the store sheet. */
export async function buyPremium(offer: PremiumOffer): Promise<User | 'cancelled'> {
  if (!SIMULATED) {
    if (!offer.pkg) throw new Error('Premium is not available right now. Please try again later.');
    try {
      await Purchases.purchasePackage(offer.pkg);
    } catch (e) {
      if (isCancel(e)) return 'cancelled';
      throw e;
    }
  }
  return api.syncPurchases();
}

/** Restore a previous purchase (required by the App Store). Resolves with the updated user. */
export async function restorePremium(): Promise<User> {
  if (!SIMULATED) {
    if (!configured) throw new Error('Purchases are not available right now. Please try again later.');
    await Purchases.restorePurchases();
  }
  return api.syncPurchases();
}
